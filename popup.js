// 全域變數
let allTabs = [];
let currentSort = 'default';
let searchKeyword = '';
let statsChart = null;
let currentPeriod = 7;

// 當彈出視窗載入時執行
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 取得所有頁籤
    allTabs = await chrome.tabs.query({});
    
    // 顯示頁籤總數
    updateTabCount();
    
    // 顯示頁籤列表
    displayTabs(getFilteredAndSortedTabs());
    
    // 設定搜尋功能
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      searchKeyword = e.target.value.toLowerCase();
      updateTabCount();
      displayTabs(getFilteredAndSortedTabs());
    });
    
    // 清除搜尋按鈕
    document.getElementById('clearSearch').addEventListener('click', () => {
      searchInput.value = '';
      searchKeyword = '';
      updateTabCount();
      displayTabs(getFilteredAndSortedTabs());
    });
    
    // 設定排序按鈕事件
    document.getElementById('sortDefault').addEventListener('click', () => {
      setActiveButton('sortDefault');
      currentSort = 'default';
      displayTabs(getFilteredAndSortedTabs());
    });
    
    document.getElementById('sortTitle').addEventListener('click', () => {
      setActiveButton('sortTitle');
      currentSort = 'title';
      displayTabs(getFilteredAndSortedTabs());
    });
    
    document.getElementById('sortUrl').addEventListener('click', () => {
      setActiveButton('sortUrl');
      currentSort = 'url';
      displayTabs(getFilteredAndSortedTabs());
    });
    
    document.getElementById('sortGroup').addEventListener('click', () => {
      setActiveButton('sortGroup');
      currentSort = 'group';
      displayTabs(getFilteredAndSortedTabs());
    });
    
    // 下載按鈕
    document.getElementById('downloadBtn').addEventListener('click', () => {
      downloadTabList();
    });
    
    // 統計按鈕
    document.getElementById('statsBtn').addEventListener('click', () => {
      toggleStatsPanel();
    });
    
    document.getElementById('closeStatsBtn').addEventListener('click', () => {
      toggleStatsPanel();
    });
    
    // 設定按鈕
    document.getElementById('settingsBtn').addEventListener('click', () => {
      toggleSettingsPanel();
    });
    
    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      toggleSettingsPanel();
    });
    
    // 統計期間按鈕
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPeriod = parseInt(e.target.dataset.period);
        updateStatsChart();
      });
    });
    
    // 匯出資料按鈕
    document.getElementById('exportDataBtn').addEventListener('click', () => {
      exportData();
    });
    
    // 匯入資料按鈕
    document.getElementById('importDataBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });
    
    document.getElementById('importFileInput').addEventListener('change', (e) => {
      importData(e.target.files[0]);
    });
    
    // 白名單管理
    document.getElementById('addWhitelistBtn').addEventListener('click', () => {
      addToWhitelist();
    });
    
    document.getElementById('whitelistInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addToWhitelist();
      }
    });
    
    // 載入白名單
    loadWhitelist();
    
  } catch (error) {
    console.error('取得頁籤資訊時發生錯誤:', error);
    document.getElementById('tabList').innerHTML = 
      '<div class="loading">無法取得頁籤資訊</div>';
  }
});

// 更新頁籤計數
function updateTabCount() {
  const filtered = getFilteredTabs();
  const tabCount = document.getElementById('tabCount');
  if (searchKeyword) {
    tabCount.textContent = `共有 ${allTabs.length} 個頁籤，顯示 ${filtered.length} 個符合的結果`;
  } else {
    tabCount.textContent = `共有 ${allTabs.length} 個頁籤`;
  }
}

// 從 URL 取得網域
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'unknown';
  }
}

// 取得網域的主要圖示
function getDomainFavicon(tabs) {
  const tabWithIcon = tabs.find(tab => tab.favIconUrl);
  return tabWithIcon ? tabWithIcon.favIconUrl : null;
}

// 下載頁籤清單為 txt 文字檔
function downloadTabList() {
  // 取得當前顯示的頁籤（考慮搜尋和排序）
  const tabsData = getFilteredAndSortedTabs();
  
  // 準備文字內容
  let content = '頁籤清單\n';
  content += '=' .repeat(80) + '\n';
  content += `總數：${allTabs.length} 個頁籤\n`;
  
  if (searchKeyword) {
    const filteredCount = getFilteredTabs().length;
    content += `搜尋結果：${filteredCount} 個符合的頁籤（關鍵字：${searchKeyword}）\n`;
  }
  
  const now = new Date();
  content += `匯出時間：${now.toLocaleString('zh-TW', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })}\n`;
  content += '=' .repeat(80) + '\n\n';
  
  // 檢查是否為群組模式
  if (tabsData.isGrouped) {
    const grouped = tabsData.grouped;
    // 按數量排序
    const domains = Object.keys(grouped).sort((a, b) => {
      return grouped[b].length - grouped[a].length;
    });
    
    domains.forEach((domain, groupIndex) => {
      const domainTabs = grouped[domain];
      content += `\n【群組 ${groupIndex + 1}】${domain}（${domainTabs.length} 個頁籤）\n`;
      content += '-'.repeat(80) + '\n';
      
      domainTabs.forEach((tab, index) => {
        content += `第 ${index + 1} 筆\n`;
        content += `標題：${tab.title || '(無標題)'}\n`;
        content += `網址：${tab.url}\n\n`;
      });
    });
  } else {
    // 一般列表模式
    const tabs = tabsData;
    
    tabs.forEach((tab, index) => {
      content += `第 ${index + 1} 筆\n`;
      content += `標題：${tab.title || '(無標題)'}\n`;
      content += `網址：${tab.url}\n\n`;
    });
  }
  
  content += '=' .repeat(80) + '\n';
  content += '檔案結尾\n';
  
  // 建立下載
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // 產生檔名（包含日期時間）
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
  a.download = `tabs_${timestamp}.txt`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 取得過濾後的頁籤
function getFilteredTabs() {
  if (!searchKeyword) return allTabs;
  
  return allTabs.filter(tab => {
    const title = (tab.title || '').toLowerCase();
    return title.includes(searchKeyword);
  });
}

// 取得過濾和排序後的頁籤
function getFilteredAndSortedTabs() {
  let tabs = getFilteredTabs();
  
  switch (currentSort) {
    case 'title':
      return [...tabs].sort((a, b) => {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        return titleA.localeCompare(titleB, 'zh-TW');
      });
    
    case 'url':
      return [...tabs].sort((a, b) => {
        const urlA = (a.url || '').toLowerCase();
        const urlB = (b.url || '').toLowerCase();
        return urlA.localeCompare(urlB);
      });
    
    case 'group':
      // 按網域分組
      const grouped = {};
      tabs.forEach(tab => {
        const domain = getDomain(tab.url);
        if (!grouped[domain]) {
          grouped[domain] = [];
        }
        grouped[domain].push(tab);
      });
      
      // 將分組轉換為特殊格式，標記為群組模式
      return { grouped, isGrouped: true };
    
    default:
      return tabs;
  }
}

// 設定啟用的按鈕
function setActiveButton(buttonId) {
  document.querySelectorAll('.sort-button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(buttonId).classList.add('active');
}

// 顯示頁籤列表
function displayTabs(tabsOrGrouped) {
  const tabList = document.getElementById('tabList');
  tabList.innerHTML = '';
  
  // 檢查是否為群組模式
  if (tabsOrGrouped.isGrouped) {
    const grouped = tabsOrGrouped.grouped;
    
    // 將網域按頁籤數量排序（由多到少）
    const domains = Object.keys(grouped).sort((a, b) => {
      return grouped[b].length - grouped[a].length;
    });
    
    if (domains.length === 0) {
      tabList.innerHTML = '<div class="loading">沒有符合的頁籤</div>';
      return;
    }
    
    domains.forEach(domain => {
      const domainTabs = grouped[domain];
      const groupElement = createDomainGroup(domain, domainTabs);
      tabList.appendChild(groupElement);
    });
  } else {
    // 一般列表模式
    const tabs = tabsOrGrouped;
    
    if (tabs.length === 0) {
      tabList.innerHTML = '<div class="loading">沒有符合的頁籤</div>';
      return;
    }
    
    tabs.forEach((tab, index) => {
      const tabItem = createTabElement(tab, index + 1);
      tabList.appendChild(tabItem);
    });
  }
}

// 建立網域群組元素
function createDomainGroup(domain, tabs) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'domain-group';
  
  // 群組標題
  const header = document.createElement('div');
  header.className = 'group-header';
  
  // 摺疊圖示
  const collapseIcon = document.createElement('span');
  collapseIcon.className = 'collapse-icon';
  collapseIcon.textContent = '▼';
  
  // 網域圖示
  const iconDiv = document.createElement('div');
  iconDiv.className = 'group-icon';
  const favicon = document.createElement('img');
  favicon.style.width = '16px';
  favicon.style.height = '16px';
  const domainFavicon = getDomainFavicon(tabs);
  favicon.src = domainFavicon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🌐</text></svg>';
  favicon.onerror = () => {
    favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🌐</text></svg>';
  };
  iconDiv.appendChild(favicon);
  
  // 網域名稱
  const domainName = document.createElement('span');
  domainName.textContent = domain;
  
  // 頁籤數量
  const count = document.createElement('span');
  count.className = 'group-count';
  count.textContent = `${tabs.length} 個頁籤`;
  
  header.appendChild(collapseIcon);
  header.appendChild(iconDiv);
  header.appendChild(domainName);
  header.appendChild(count);
  
  // 點擊標題摺疊/展開
  header.addEventListener('click', () => {
    groupDiv.classList.toggle('group-collapsed');
  });
  
  // 群組內容
  const content = document.createElement('div');
  content.className = 'group-content';
  
  tabs.forEach((tab, index) => {
    const tabItem = createTabElement(tab, index + 1);
    content.appendChild(tabItem);
  });
  
  groupDiv.appendChild(header);
  groupDiv.appendChild(content);
  
  return groupDiv;
}

// 建立頁籤元素
function createTabElement(tab, index) {
  const div = document.createElement('div');
  div.className = 'tab-item';
  
  // 點擊時切換到該頁籤
  div.addEventListener('click', () => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  });
  
  // 頁籤標題區
  const header = document.createElement('div');
  header.className = 'tab-header';
  
  // 網站圖示
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🌐</text></svg>';
  favicon.onerror = () => {
    favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🌐</text></svg>';
  };
  
  // 頁籤標題
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = `${index}. ${tab.title || '(無標題)'}`;
  title.title = tab.title; // 顯示完整標題的提示
  
  header.appendChild(favicon);
  header.appendChild(title);
  
  // URL
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;
  
  // 頁籤資訊標籤
  const info = document.createElement('div');
  info.className = 'tab-info';
  
  // 狀態標籤
  const badges = [];
  
  if (tab.active) {
    badges.push(createBadge('🟢 使用中', 'badge-active'));
  }
  
  if (tab.pinned) {
    badges.push(createBadge('📌 已釘選', 'badge-pinned'));
  }
  
  if (tab.audible) {
    badges.push(createBadge('🔊 播放中', 'badge-audible'));
  }
  
  if (tab.discarded) {
    badges.push(createBadge('💤 已休眠', 'badge-inactive'));
  }
  
  // 視窗 ID
  badges.push(createBadge(`視窗 #${tab.windowId}`, 'badge-inactive'));
  
  // 頁籤 ID
  badges.push(createBadge(`ID: ${tab.id}`, 'badge-inactive'));
  
  badges.forEach(badge => info.appendChild(badge));
  
  // 組合所有元素
  div.appendChild(header);
  div.appendChild(url);
  div.appendChild(info);
  
  return div;
}

// 建立標籤元素
function createBadge(text, className) {
  const span = document.createElement('span');
  span.className = `tab-badge ${className}`;
  span.textContent = text;
  return span;
}

// 切換統計面板
function toggleStatsPanel() {
  const panel = document.getElementById('statsPanel');
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    document.getElementById('settingsPanel').style.display = 'none';
    // 顯示統計時載入圖表
    updateStatsChart();
  } else {
    panel.style.display = 'none';
  }
}

// 切換設定面板
function toggleSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    document.getElementById('statsPanel').style.display = 'none';
  } else {
    panel.style.display = 'none';
  }
}

// 匯出資料
async function exportData() {
  const { statistics = {}, whitelist = [] } = await chrome.storage.local.get(['statistics', 'whitelist']);
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    statistics: statistics,
    whitelist: whitelist
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
  a.download = `tab-extension-data_${timestamp}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert('資料已匯出！');
}

// 匯入資料
async function importData(file) {
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // 驗證資料格式
      if (!data.version || !data.statistics) {
        alert('檔案格式錯誤！');
        return;
      }
      
      // 確認匯入
      if (!confirm('匯入資料會覆蓋現有的統計資料和白名單，確定要繼續嗎？')) {
        return;
      }
      
      // 儲存資料
      await chrome.storage.local.set({
        statistics: data.statistics || {},
        whitelist: data.whitelist || []
      });
      
      // 重新載入介面
      loadWhitelist();
      if (document.getElementById('statsPanel').style.display !== 'none') {
        updateStatsChart();
      }
      
      alert('資料匯入成功！');
      
    } catch (error) {
      console.error('Import error:', error);
      alert('匯入失敗：' + error.message);
    }
  };
  
  reader.readAsText(file);
  
  // 清空 input，允許重複選擇同一檔案
  document.getElementById('importFileInput').value = '';
}

// 更新統計圖表
async function updateStatsChart() {
  console.log('updateStatsChart called');
  
  // 檢查 Chart.js 是否載入
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded!');
    const container = document.querySelector('.chart-container');
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #f44336;">
        <div style="font-size: 18px; margin-bottom: 10px;">⚠️ Chart.js 未載入</div>
        <div style="font-size: 14px; color: #666;">
          請參考 HOW_TO_ADD_CHARTJS.md 說明<br>
          手動下載 chart.min.js 檔案
        </div>
      </div>
    `;
    return;
  }
  
  const { statistics = {} } = await chrome.storage.local.get('statistics');
  console.log('Statistics data:', statistics);
  
  const allTabs = await chrome.tabs.query({});
  
  // 計算日期範圍
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - currentPeriod + 1);
  
  // 準備圖表資料
  const labels = [];
  const openedData = [];
  const closedData = [];
  
  let totalOpened = 0;
  let totalClosed = 0;
  let daysWithData = 0;
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const dayData = statistics[dateKey] || { opened: 0, closed: 0 };
    
    // 格式化日期標籤
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    labels.push(label);
    
    openedData.push(dayData.opened);
    closedData.push(dayData.closed);
    
    totalOpened += dayData.opened;
    totalClosed += dayData.closed;
    
    if (dayData.opened > 0 || dayData.closed > 0) {
      daysWithData++;
    }
  }
  
  console.log('Chart data prepared:', { labels, openedData, closedData });
  
  // 更新統計數字
  document.getElementById('totalOpened').textContent = totalOpened;
  document.getElementById('totalClosed').textContent = totalClosed;
  document.getElementById('avgOpened').textContent = daysWithData > 0 ? Math.round(totalOpened / daysWithData) : 0;
  document.getElementById('currentTabs').textContent = allTabs.length;
  
  // 建立或更新圖表
  const canvas = document.getElementById('statsChart');
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  
  if (statsChart) {
    console.log('Destroying existing chart');
    statsChart.destroy();
  }
  
  console.log('Creating new chart');
  
  try {
    statsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '開啟',
            data: openedData,
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: '關閉',
            data: closedData,
            borderColor: '#f44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12,
                family: "'Microsoft JhengHei', sans-serif"
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y + ' 個';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: {
                size: 11
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: {
                size: 10
              }
            },
            grid: {
              display: false
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
    
    console.log('Chart created successfully');
  } catch (error) {
    console.error('Error creating chart:', error);
    const container = document.querySelector('.chart-container');
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #f44336;">⚠️ 圖表建立失敗<br>' + error.message + '</div>';
  }
}

// 載入白名單
async function loadWhitelist() {
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  displayWhitelist(whitelist);
}

// 顯示白名單
function displayWhitelist(whitelist) {
  const container = document.getElementById('whitelistItems');
  container.innerHTML = '';
  
  if (whitelist.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#999';
    empty.style.fontSize = '12px';
    empty.textContent = '尚未新增任何白名單';
    container.appendChild(empty);
    return;
  }
  
  whitelist.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    
    const text = document.createElement('span');
    text.textContent = domain;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = '移除';
    removeBtn.addEventListener('click', () => {
      removeFromWhitelist(domain);
    });
    
    item.appendChild(text);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

// 新增到白名單
async function addToWhitelist() {
  const input = document.getElementById('whitelistInput');
  const domain = input.value.trim().toLowerCase();
  
  if (!domain) return;
  
  // 驗證網域格式
  if (!/^[a-z0-9]+([\-\.][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
    alert('請輸入有效的網域格式，例如：google.com');
    return;
  }
  
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  
  if (whitelist.includes(domain)) {
    alert('此網域已在白名單中');
    return;
  }
  
  whitelist.push(domain);
  await chrome.storage.local.set({ whitelist });
  
  displayWhitelist(whitelist);
  input.value = '';
}

// 從白名單移除
async function removeFromWhitelist(domain) {
  const { whitelist = [] } = await chrome.storage.local.get('whitelist');
  const newWhitelist = whitelist.filter(d => d !== domain);
  await chrome.storage.local.set({ whitelist: newWhitelist });
  displayWhitelist(newWhitelist);
}
