// 智能问答Agent API 管理类 - 支持DeepSeek
class AIService {
    constructor() {
        // 配置不同的AI服务提供商
        this.providers = {
            'deepseek': {
                name: 'DeepSeek',
                endpoint: 'https://api.deepseek.com/v1/chat/completions',
                models: ['deepseek-chat', 'deepseek-coder'],
                max_tokens: 2048
            },
            'openai': {
                name: 'OpenAI',
                endpoint: 'https://api.openai.com/v1/chat/completions',
                models: ['gpt-3.5-turbo', 'gpt-4'],
                max_tokens: 1000
            },
            'local': {
                name: '本地模型',
                endpoint: 'http://localhost:11434/api/generate',
                max_tokens: 1000
            }
        };
        
        this.currentProvider = 'deepseek'; // 默认使用DeepSeek
        this.apiKey = this.loadApiKey();
        this.init();
    }

    init() {
        // 从localStorage加载配置
        const savedProvider = localStorage.getItem('ai_provider');
        if (savedProvider && this.providers[savedProvider]) {
            this.currentProvider = savedProvider;
        }
        
        // 检查API配置
        this.checkApiConfiguration();
    }

    // 加载API密钥
    loadApiKey() {
        return localStorage.getItem('ai_api_key') || '';
    }

    // 保存API配置
    saveApiConfiguration(provider, apiKey, model) {
        if (!this.providers[provider]) {
            this.showFeedback('不支持的AI服务提供商', 'error');
            return false;
        }
        
        this.currentProvider = provider;
        this.apiKey = apiKey;
        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('ai_api_key', apiKey);
        if (model) {
            localStorage.setItem('ai_model', model);
        }
        
        this.showFeedback('API配置已保存', 'success');
        return true;
    }

    // 检查API配置
    checkApiConfiguration() {
        if (!this.apiKey && this.currentProvider !== 'local') {
            this.showFeedback('请先配置API密钥', 'warning');
            return false;
        }
        return true;
    }

    // 发送消息到AI服务
    async sendMessage(messages, context = {}) {
        if (!this.checkApiConfiguration()) {
            throw new Error('API未配置');
        }

        try {
            switch(this.currentProvider) {
                case 'deepseek':
                    return await this.callDeepSeekAPI(messages, context);
                case 'openai':
                    return await this.callOpenAI(messages, context);
                case 'local':
                    return await this.callLocalAI(messages, context);
                default:
                    throw new Error('不支持的AI服务提供商');
            }
        } catch (error) {
            console.error('AI API调用错误:', error);
            throw error;
        }
    }

    // 调用DeepSeek API
    async callDeepSeekAPI(messages, context) {
        const provider = this.providers.deepseek;
        
        const response = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: context.model || 'deepseek-chat',
                messages: messages,
                temperature: context.temperature || 0.7,
                max_tokens: context.max_tokens || provider.max_tokens,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API错误: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '抱歉，没有收到有效的回复。';
    }

    // 调用OpenAI API
    async callOpenAI(messages, context) {
        const provider = this.providers.openai;
        
        const response = await fetch(provider.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: context.model || 'gpt-3.5-turbo',
                messages: messages,
                temperature: context.temperature || 0.7,
                max_tokens: context.max_tokens || provider.max_tokens
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API错误: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content;
    }

    // 调用本地模型（如Ollama）
    async callLocalAI(messages, context) {
        const response = await fetch(this.providers.local.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama2',
                prompt: messages[messages.length - 1].content,
                stream: false,
                ...context
            })
        });

        if (!response.ok) {
            throw new Error(`本地AI服务错误: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    }

    // 流式传输支持（可选，用于更好的用户体验）
    async sendMessageStream(messages, onChunk, onComplete) {
        if (!this.checkApiConfiguration()) {
            throw new Error('API未配置');
        }

        // 只支持DeepSeek流式传输
        if (this.currentProvider !== 'deepseek') {
            const response = await this.sendMessage(messages);
            onComplete(response);
            return;
        }

        try {
            const response = await fetch(this.providers.deepseek.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: this.providers.deepseek.max_tokens,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API错误: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';
                            if (content) {
                                fullResponse += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            console.error('解析流数据错误:', e);
                        }
                    }
                }
            }

            onComplete(fullResponse);
        } catch (error) {
            console.error('流式传输错误:', error);
            throw error;
        }
    }

    // 显示反馈消息
    showFeedback(message, type = 'info') {
        const feedbackDiv = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 
                       type === 'error' ? 'bg-red-500' : 
                       type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
        
        feedbackDiv.className = `fixed top-20 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
        feedbackDiv.textContent = message;
        
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => {
            feedbackDiv.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            feedbackDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                feedbackDiv.remove();
            }, 300);
        }, 3000);
    }

    // 测试API连接
    async testConnection() {
        try {
            const testMessage = {
                role: 'user',
                content: '请只回复两个字："成功"'
            };
            
            const response = await this.sendMessage([testMessage], {
                max_tokens: 10
            });
            
            return response && response.trim() === '成功';
        } catch (error) {
            console.error('API连接测试失败:', error);
            return false;
        }
    }

    // 获取可用模型
    getAvailableModels() {
        return this.providers[this.currentProvider]?.models || [];
    }

    // 获取当前配置信息
    getCurrentConfig() {
        return {
            provider: this.currentProvider,
            providerName: this.providers[this.currentProvider]?.name,
            hasApiKey: !!this.apiKey,
            models: this.getAvailableModels()
        };
    }
}

// 创建全局AI服务实例
const aiService = new AIService();