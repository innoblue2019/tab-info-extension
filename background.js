// 暫時忽略的網域列表（網域 -> 過期時間戳）
let temporaryIgnore = {};

// 獲取今天的日期字串 (YYYY-MM-DD)
function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// 初始化今天的統計資料
async function initTodayStats() {
  const today = getTodayKey();
  const { statistics = {} } = await chrome.storage.local.get('statistics');
  
  if (!statistics[today]) {
    statistics[today] = {
      opened: 0,
      closed: 0,
      maxTabs: 0
    };
    await chrome.storage.local.set({ statistics });
  }
}

// 更新今天的統計資料
async function updateTodayStats(type) {
  const today = getTodayKey();
  const { statistics = {} } = await chrome.storage.local.get('statistics');
  
  if (!statistics[today]) {
    statistics[today] = {
      opened: 0,
      closed: 0,
      maxTabs: 0
    };
  }
  
  // 更新計數
  if (type === 'opened') {
    statistics[today].opened++;
  } else if (type === 'closed') {
    statistics[today].closed++;
  }
  
  // 更新當前最高分頁數
  const allTabs = await chrome.tabs.query({});
  const currentTabCount = allTabs.length;
  if (currentTabCount > statistics[today].maxTabs) {
    statistics[today].maxTabs = currentTabCount;
  }
  
  await chrome.storage.local.set({ statistics });
}

// 清理超過 1 年的舊資料
async function cleanOldStatistics() {
  const { statistics = {} } = await chrome.storage.local.get('statistics');
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffDate = oneYearAgo.toISOString().split('T')[0];
  
  let changed = false;
  Object.keys(statistics).forEach(date => {
    if (date < cutoffDate) {
      delete statistics[date];
      changed = true;
    }
  });
  
  if (changed) {
    await chrome.storage.local.set({ statistics });
  }
}

// 檢查網域是否在暫時忽略列表中
function isTemporarilyIgnored(domain) {
  if (temporaryIgnore[domain]) {
    const now = Date.now();
    if (now < temporaryIgnore[domain]) {
      return true; // 還在忽略期間
    } else {
      // 已過期，移除
      delete temporaryIgnore[domain];
      return false;
    }
  }
  return false;
}

// 從 URL 取得網域
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

// 檢查重複網域並發送通知
async function checkDuplicateDomain(tabId, url) {
  const domain = getDomain(url);
  
  // 無效網域或特殊頁面
  if (!domain || domain === 'newtab' || url.startsWith('chrome://') || url.startsWith('edge://')) {
    return;
  }
  
  // 檢查是否在白名單中
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  if (whitelist.includes(domain)) {
    return;
  }
  
  // 檢查是否暫時忽略
  if (isTemporarilyIgnored(domain)) {
    return;
  }
  
  // 取得所有分頁
  const allTabs = await chrome.tabs.query({});
  
  // 計算同網域的分頁數量（排除當前分頁）
  const sameDomainTabs = allTabs.filter(tab => {
    if (tab.id === tabId) return false;
    const tabDomain = getDomain(tab.url);
    return tabDomain === domain;
  });
  
  // 設定觸發門檻（當已有 2 個或以上相同網域時提醒）
  const threshold = 2;
  
  if (sameDomainTabs.length >= threshold) {
    // 發送通知
    const notificationId = `duplicate-${domain}-${Date.now()}`;
    
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icon128.png',
      title: '⚠️ 重複網域提醒',
      message: `已有 ${sameDomainTabs.length} 個 ${domain} 分頁開啟`,
      buttons: [
        { title: '查看現有分頁' },
        { title: '30分鐘內忽略' }
      ],
      priority: 1,
      requireInteraction: false
    });
    
    // 儲存通知相關資訊
    chrome.storage.local.set({
      [`notification-${notificationId}`]: {
        domain: domain,
        tabIds: sameDomainTabs.map(t => t.id),
        currentTabId: tabId
      }
    });
  }
}

// 監聽分頁建立
chrome.tabs.onCreated.addListener(async (tab) => {
  await updateTodayStats('opened');
});

// 監聽分頁移除
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await updateTodayStats('closed');
});

// 監聽分頁更新（URL 變化）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在 URL 變化且載入完成時檢查
  if (changeInfo.url) {
    checkDuplicateDomain(tabId, changeInfo.url);
  }
});

// 監聽通知按鈕點擊
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const key = `notification-${notificationId}`;
  const { [key]: notificationData } = await chrome.storage.local.get(key);
  
  if (!notificationData) return;
  
  const { domain, tabIds, currentTabId } = notificationData;
  
  if (buttonIndex === 0) {
    // 按鈕 1：查看現有分頁（切換到第一個相同網域的分頁）
    if (tabIds.length > 0) {
      const firstTabId = tabIds[0];
      chrome.tabs.update(firstTabId, { active: true });
      
      // 取得該分頁所在的視窗並聚焦
      const tab = await chrome.tabs.get(firstTabId);
      chrome.windows.update(tab.windowId, { focused: true });
    }
  } else if (buttonIndex === 1) {
    // 按鈕 2：30分鐘內忽略
    const ignoreUntil = Date.now() + (30 * 60 * 1000); // 30 分鐘
    temporaryIgnore[domain] = ignoreUntil;
    
    // 顯示確認通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: '✅ 已設定忽略',
      message: `30分鐘內不會提醒 ${domain}`,
      priority: 0
    });
  }
  
  // 清除通知
  chrome.notifications.clear(notificationId);
  chrome.storage.local.remove(key);
});

// 監聽通知點擊（點擊通知本身）
chrome.notifications.onClicked.addListener(async (notificationId) => {
  const key = `notification-${notificationId}`;
  const { [key]: notificationData } = await chrome.storage.local.get(key);
  
  if (!notificationData) return;
  
  const { tabIds } = notificationData;
  
  // 切換到第一個相同網域的分頁
  if (tabIds.length > 0) {
    const firstTabId = tabIds[0];
    chrome.tabs.update(firstTabId, { active: true });
    
    const tab = await chrome.tabs.get(firstTabId);
    chrome.windows.update(tab.windowId, { focused: true });
  }
  
  chrome.notifications.clear(notificationId);
  chrome.storage.local.remove(key);
});

// 初始化：設定今天的統計並清理舊資料
initTodayStats();
cleanOldStatistics();

// 清理過期的暫時忽略記錄（每小時執行一次）
setInterval(() => {
  const now = Date.now();
  Object.keys(temporaryIgnore).forEach(domain => {
    if (now >= temporaryIgnore[domain]) {
      delete temporaryIgnore[domain];
    }
  });
}, 60 * 60 * 1000);

// 每天清理一次舊資料（每 24 小時）
setInterval(() => {
  cleanOldStatistics();
}, 24 * 60 * 60 * 1000);

// 建立右鍵選單
chrome.runtime.onInstalled.addListener(() => {
  // 固定分頁選單
  chrome.contextMenus.create({
    id: 'pinTab',
    title: '📌 固定分頁',
    contexts: ['page', 'frame', 'link', 'image']
  });
  
  // 關閉分頁選單
  chrome.contextMenus.create({
    id: 'closeTab',
    title: '✕ 關閉分頁',
    contexts: ['page', 'frame', 'link', 'image']
  });
});

// 處理右鍵選單點擊
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'pinTab') {
    // 固定分頁
    try {
      await chrome.tabs.update(tab.id, { pinned: true });
    } catch (error) {
      console.error('Failed to pin tab:', error);
    }
  } else if (info.menuItemId === 'closeTab') {
    // 關閉分頁
    try {
      await chrome.tabs.remove(tab.id);
    } catch (error) {
      console.error('Failed to close tab:', error);
    }
  }
});

console.log('Tab duplicate checker and statistics service loaded');
