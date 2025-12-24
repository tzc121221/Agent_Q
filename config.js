// API配置相关函数
function showApiConfig() {
    const modal = document.getElementById('api-config-modal');
    modal.classList.remove('hidden');
    
    // 加载保存的配置
    const savedProvider = localStorage.getItem('ai_provider') || 'deepseek';
    const savedKey = localStorage.getItem('ai_api_key') || '';
    const savedModel = localStorage.getItem('ai_model') || 'deepseek-chat';
    
    document.getElementById('api-provider').value = savedProvider;
    document.getElementById('api-key-input').value = savedKey;
    document.getElementById('model-select').value = savedModel;
    
    // 根据提供商显示/隐藏字段
    toggleApiFields(savedProvider);
}

function closeApiConfig() {
    document.getElementById('api-config-modal').classList.add('hidden');
    document.getElementById('test-result').classList.add('hidden');
    document.getElementById('test-result').innerHTML = '';
}

function saveApiConfig() {
    const provider = document.getElementById('api-provider').value;
    const apiKey = document.getElementById('api-key-input').value.trim();
    const model = document.getElementById('model-select').value;
    
    // 验证输入
    if (provider !== 'local' && !apiKey) {
        aiService.showFeedback('请输入API密钥', 'error');
        return;
    }
    
    if (provider !== 'local' && !apiKey.startsWith('sk-')) {
        aiService.showFeedback('API密钥格式不正确，应以sk-开头', 'warning');
        // 仍然允许保存，因为某些API可能格式不同
    }
    
    // 保存配置
    const success = aiService.saveApiConfiguration(provider, apiKey, model);
    
    if (success) {
        closeApiConfig();
    }
}

async function testApiConnection() {
    const provider = document.getElementById('api-provider').value;
    const apiKey = document.getElementById('api-key-input').value.trim();
    
    if (provider !== 'local' && !apiKey) {
        aiService.showFeedback('请输入API密钥', 'error');
        return;
    }
    
    // 显示加载状态
    const testBtnText = document.getElementById('test-btn-text');
    const testLoading = document.getElementById('test-loading');
    const testResult = document.getElementById('test-result');
    
    testBtnText.textContent = '测试中...';
    testLoading.classList.remove('hidden');
    testResult.classList.add('hidden');
    
    // 临时保存配置用于测试
    const originalConfig = aiService.getCurrentConfig();
    aiService.currentProvider = provider;
    aiService.apiKey = apiKey;
    
    try {
        const connected = await aiService.testConnection();
        
        testBtnText.textContent = '测试连接';
        testLoading.classList.add('hidden');
        testResult.classList.remove('hidden');
        
        if (connected) {
            testResult.className = 'p-3 rounded text-sm bg-green-500 bg-opacity-20 text-green-400';
            testResult.innerHTML = '✅ 连接成功！API配置正确。';
        } else {
            testResult.className = 'p-3 rounded text-sm bg-red-500 bg-opacity-20 text-red-400';
            testResult.innerHTML = '❌ 连接失败。请检查：<br>1. API密钥是否正确<br>2. 网络连接是否正常<br>3. API服务是否可用';
        }
    } catch (error) {
        testBtnText.textContent = '测试连接';
        testLoading.classList.add('hidden');
        testResult.classList.remove('hidden');
        testResult.className = 'p-3 rounded text-sm bg-red-500 bg-opacity-20 text-red-400';
        testResult.innerHTML = `❌ 测试出错: ${error.message}`;
    } finally {
        // 恢复原始配置
        aiService.currentProvider = originalConfig.provider;
        aiService.apiKey = localStorage.getItem('ai_api_key') || '';
    }
}

function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('api-key-input');
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
}

function toggleApiFields(provider) {
    const apiKeyGroup = document.getElementById('api-key-group');
    const modelGroup = document.getElementById('model-group');
    
    if (provider === 'local') {
        apiKeyGroup.classList.add('hidden');
        modelGroup.classList.add('hidden');
    } else {
        apiKeyGroup.classList.remove('hidden');
        modelGroup.classList.remove('hidden');
        
        // 根据提供商更新模型选项
        const modelSelect = document.getElementById('model-select');
        modelSelect.innerHTML = '';
        
        const models = aiService.providers[provider]?.models || [];
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }
}

// 监听提供商变化
document.getElementById('api-provider').addEventListener('change', function() {
    toggleApiFields(this.value);
});