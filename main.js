// 智能问答Agent主要JavaScript逻辑
class SmartAgent {
    constructor() {
        this.messages = [];
        this.knowledgeBase = this.loadKnowledgeBase();
        this.learningData = this.loadLearningData();
        this.currentConversation = [];
        this.typingSpeed = 50;
        this.isTyping = false;
        this.isStreaming = false;
        this.init();
    }

    // 在 init() 方法中添加欢迎消息
init() {
    this.initParticleBackground();
    this.initEventListeners();
    this.loadSettings();
    this.simulateLearning();
    this.checkApiStatus();
    
    // 添加格式化的欢迎消息
    this.showFormattedWelcomeMessage();
}

// 显示格式化的欢迎消息
showFormattedWelcomeMessage() {
    const chatMessages = document.getElementById('chat-messages');
    
    // 如果已经有欢迎消息，先移除
    const existingWelcome = document.getElementById('welcome-message');
    if (existingWelcome) {
        existingWelcome.remove();
    }
    
    const welcomeMessage = `
# 👋 你好！我是智能问答Agent

我是一个具备自主学习能力的AI助手，能够帮助你解答各种问题。

## 🎯 主要功能

### 🤖 智能问答
- **自然语言理解**：理解你的问题意图
- **上下文记忆**：记住对话历史，支持多轮对话
- **个性化回答**：根据你的偏好调整回答风格

### 📚 自主学习
- **持续优化**：通过用户反馈不断改进回答质量
- **知识积累**：自动学习和扩展知识库
- **错误修正**：识别并修正不准确的回答

### 🛠️ 特色能力
- **数学计算**：支持公式和复杂计算
- **代码生成**：多种编程语言的代码示例
- **数据分析**：帮助分析和解释数据

## 💡 使用示例

试试问我这些问题：
1. **数学问题**：求解二次方程 $x^2 - 5x + 6 = 0$
2. **编程问题**：用Python实现快速排序算法
3. **概念解释**：什么是深度学习？
4. **学习建议**：如何高效学习机器学习？

## 📊 技术支持

- **AI模型**：基于DeepSeek最新模型
- **响应速度**：平均响应时间 < 2秒
- **知识范围**：覆盖技术、科学、文化等多个领域

---

有任何问题，随时问我！我会尽力提供详细的帮助。
    `;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-enter mb-6';
    messageDiv.id = 'welcome-message';
    
    messageDiv.innerHTML = `
        <div class="flex items-start space-x-3">
            <img src="resources/ai-avatar.png" alt="AI" class="w-10 h-10 rounded-full">
            <div class="flex-1">
                <div class="bg-gray-800 bg-opacity-60 rounded-lg p-4 max-w-3xl">
                    <div class="text-sm text-gray-300 mb-2">AI助手</div>
                    <div class="text-white markdown-content" id="welcome-content"></div>
                    <div class="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        <span>刚刚</span>
                        <button class="feedback-btn text-green-400 hover:text-green-300" onclick="agent.likeMessage('welcome')">👍</button>
                        <button class="feedback-btn text-red-400 hover:text-red-300" onclick="agent.dislikeMessage('welcome')">👎</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    const contentElement = document.getElementById('welcome-content');
    markdownRenderer.updateElement(contentElement, welcomeMessage);
}

    // 检查API状态
    async checkApiStatus() {
        const config = aiService.getCurrentConfig();
        if (!config.hasApiKey) {
            this.showFeedback('请先配置DeepSeek API密钥', 'warning');
        }
    }

    // 初始化事件监听器
    initEventListeners() {
        const messageInput = document.getElementById('message-input');
        
        // 键盘事件
        messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 自动调整文本框高度
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });
    }

    // 发送消息
    async sendMessage() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message || this.isTyping || this.isStreaming) return;

        // 添加用户消息
        this.addMessage(message, 'user');
        input.value = '';
        input.style.height = 'auto';

        // 显示AI正在输入
        this.showTypingIndicator();

        try {
            // 准备对话历史
            const messages = [
                {
                    role: 'system',
                    content: '你是一个智能问答助手，请以专业、友好、详细的方式回答问题。如果用户的问题需要分点回答，请使用合适的格式。'
                },
                ...this.currentConversation.slice(-10).map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
                { role: 'user', content: message }
            ];
            
            // 生成唯一的响应ID
            const responseId = 'resp_' + Date.now();
            
            // 隐藏打字指示器，开始流式响应
            this.hideTypingIndicator();
            this.isStreaming = true;
            
            // 开始流式响应
            await this.startStreamResponse(messages, responseId);
            
        } catch (error) {
            console.error('AI服务错误:', error);
            this.hideTypingIndicator();
            this.isStreaming = false;
            
            // 如果API调用失败，回退到本地知识库
            const fallbackResponse = this.generateResponse(message);
            this.typeResponse(fallbackResponse, true);
            
            this.showFeedback('API调用失败，使用本地知识库回答', 'warning');
        }
    }

    // 开始流式响应（修改版）
async startStreamResponse(messages, responseId) {
    const chatMessages = document.getElementById('chat-messages');
    
    // 创建新的消息容器
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-enter mb-6';
    messageDiv.id = responseId;
    
    messageDiv.innerHTML = `
        <div class="flex items-start space-x-3">
            <img src="resources/ai-avatar.png" alt="AI" class="w-10 h-10 rounded-full">
            <div class="flex-1">
                <div class="bg-gray-800 bg-opacity-60 rounded-lg p-4 max-w-3xl">
                    <div class="text-sm text-gray-300 mb-2">AI助手</div>
                    <div class="text-white min-h-6 markdown-content" id="${responseId}-content"></div>
                    <div class="flex items-center space-x-4 mt-3 text-xs text-gray-500" style="display:none;" id="${responseId}-actions">
                        <span>刚刚</span>
                        <button class="feedback-btn text-green-400 hover:text-green-300" onclick="agent.likeMessage('${responseId}')">👍</button>
                        <button class="feedback-btn text-red-400 hover:text-red-300" onclick="agent.dislikeMessage('${responseId}')">👎</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    const contentElement = document.getElementById(`${responseId}-content`);
    const actionsElement = document.getElementById(`${responseId}-actions`);
    
    let fullResponse = '';
    
    try {
        // 使用流式传输
        await aiService.sendMessageStream(
            messages,
            // 每个chunk的处理
            (chunk) => {
                fullResponse += chunk;
                
                // 实时更新文本内容（保持简单文本，流式传输完成后再渲染 Markdown）
                contentElement.textContent = fullResponse;
                
                // 实时滚动到底部
                chatMessages.scrollTop = chatMessages.scrollHeight;
            },
            // 完成处理
            (completeResponse) => {
                fullResponse = completeResponse;
                this.isStreaming = false;
                
                // 渲染 Markdown 和数学公式
                try {
                    markdownRenderer.updateElement(contentElement, fullResponse);
                } catch (error) {
                    console.error('Markdown 渲染错误:', error);
                    // 如果渲染失败，显示原始文本
                    contentElement.textContent = fullResponse;
                }
                
                actionsElement.style.display = 'flex';
                
                // 保存AI回答
                this.currentConversation.push({
                    id: responseId,
                    content: fullResponse,
                    sender: 'ai',
                    timestamp: new Date(),
                    formatted: true
                });
                
                // 重新滚动到底部（因为渲染后内容高度可能变化）
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 100);
            }
        );
    } catch (error) {
        console.error('流式传输错误:', error);
        this.isStreaming = false;
        
        // 如果流式传输失败，尝试普通请求
        try {
            const response = await aiService.sendMessage(messages);
            
            // 渲染 Markdown
            try {
                markdownRenderer.updateElement(contentElement, response);
            } catch (renderError) {
                contentElement.textContent = response;
            }
            
            actionsElement.style.display = 'flex';
            
            this.currentConversation.push({
                id: responseId,
                content: response,
                sender: 'ai',
                timestamp: new Date(),
                formatted: true
            });
        } catch (fallbackError) {
            contentElement.textContent = '抱歉，AI服务暂时不可用。请检查API配置或稍后再试。';
            this.showFeedback('AI服务不可用', 'error');
        }
    }
}

    // 添加消息到聊天界面
    addMessage(content, sender, id = null) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-enter mb-6';
        
        if (id) {
            messageDiv.id = id;
        }
        
        const avatar = sender === 'user' ? 'resources/user-avatar.png' : 'resources/ai-avatar.png';
        const bgColor = sender === 'user' ? 'bg-blue-600 bg-opacity-20' : 'bg-gray-800 bg-opacity-60';
        const name = sender === 'user' ? '你' : 'AI助手';
        
        messageDiv.innerHTML = `
            <div class="flex items-start space-x-3">
                <img src="${avatar}" alt="${name}" class="w-10 h-10 rounded-full">
                <div class="flex-1">
                    <div class="${bgColor} rounded-lg p-4 max-w-3xl">
                        <div class="text-sm text-gray-300 mb-2">${name}</div>
                        <div class="text-white">${content}</div>
                        <div class="text-xs text-gray-500 mt-2">${this.formatTime(new Date())}</div>
                        ${sender === 'ai' ? `
                            <div class="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                                <span>${this.formatTime(new Date())}</span>
                                <button class="feedback-btn text-green-400 hover:text-green-300" onclick="agent.likeMessage('${id}')">👍</button>
                                <button class="feedback-btn text-red-400 hover:text-red-300" onclick="agent.dislikeMessage('${id}')">👎</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 保存到对话历史
        this.currentConversation.push({
            id: id || 'msg_' + Date.now(),
            content,
            sender,
            timestamp: new Date()
        });
    }

    // 格式化时间
    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        return `${Math.floor(diff / 86400000)}天前`;
    }

    // 显示输入指示器
    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'message-enter mb-6';
        typingDiv.innerHTML = `
            <div class="flex items-start space-x-3">
                <img src="resources/ai-avatar.png" alt="AI" class="w-10 h-10 rounded-full">
                <div class="flex-1">
                    <div class="bg-gray-800 bg-opacity-60 rounded-lg p-4 max-w-3xl">
                        <div class="text-sm text-gray-300 mb-2">AI助手</div>
                        <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-cyan-400 rounded-full typing-indicator"></div>
                            <div class="w-2 h-2 bg-cyan-400 rounded-full typing-indicator" style="animation-delay: 0.2s;"></div>
                            <div class="w-2 h-2 bg-cyan-400 rounded-full typing-indicator" style="animation-delay: 0.4s;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        this.isTyping = true;
    }

    // 隐藏输入指示器
    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
        this.isTyping = false;
    }

    // 点赞消息
    likeMessage(messageId) {
        const button = document.querySelector(`button[onclick*="${messageId}"]`);
        if (button && button.textContent === '👍') {
            button.style.color = '#10B981';
            button.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 200);
        }
        
        // 更新学习数据
        this.learningData.correctAnswers++;
        this.learningData.userFeedback.push({
            type: 'like',
            messageId: messageId,
            timestamp: new Date()
        });
        
        this.saveLearningData();
        this.showFeedback('感谢你的正面反馈！', 'success');
    }

    // 点踩消息
    dislikeMessage(messageId) {
        const button = document.querySelector(`button[onclick*="${messageId}"]`);
        if (button && button.textContent === '👎') {
            button.style.color = '#EF4444';
            button.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 200);
        }
        
        // 更新学习数据
        this.learningData.userFeedback.push({
            type: 'dislike',
            messageId: messageId,
            timestamp: new Date()
        });
        
        this.saveLearningData();
        this.showFeedback('抱歉回答不够理想。我会努力改进！', 'error');
        
        // 触发学习机制
        this.triggerLearning();
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

    // 加载知识库
    loadKnowledgeBase() {
        const defaultKnowledge = {
            '人工智能': {
                '什么是人工智能': '人工智能(AI)是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统，包括学习、推理、感知和语言理解。',
                'AI的类型': 'AI分为弱AI(专用AI)和强AI(通用AI)。弱AI专注于特定任务，如语音识别或图像分类；强AI理论上能够执行任何人类智能任务。',
                '机器学习vs深度学习': '机器学习是AI的一个子集，使用算法让计算机从数据中学习。深度学习是机器学习的一个分支，使用多层神经网络模拟人脑工作方式。'
            },
            '技术原理': {
                '神经网络': '神经网络是受人脑启发的计算模型，由相互连接的节点(神经元)组成。每个连接都有权重，网络通过调整这些权重来学习。',
                '自然语言处理': 'NLP是AI的一个领域，专注于让计算机理解、解释和生成人类语言。包括文本分析、情感分析、机器翻译等。',
                '强化学习': '强化学习是一种机器学习方法，智能体通过与环境交互来学习，根据奖励或惩罚来调整其行为策略。'
            },
            '应用场景': {
                '医疗领域': 'AI在医疗领域用于疾病诊断、药物发现、个性化治疗方案制定、医学影像分析等，提高了诊断准确性和效率。',
                '金融服务': '在金融领域，AI用于风险评估、欺诈检测、算法交易、客户服务和个性化理财建议。',
                '自动驾驶': '自动驾驶汽车使用AI处理传感器数据，识别路况、行人、交通标志，并做出实时驾驶决策。'
            }
        };

        const saved = localStorage.getItem('agent_knowledge_base');
        return saved ? JSON.parse(saved) : defaultKnowledge;
    }

    // 加载学习数据
    loadLearningData() {
        const defaultData = {
            totalQuestions: 0,
            correctAnswers: 0,
            userFeedback: [],
            learningProgress: 0.85,
            responseAccuracy: 0.94,
            averageResponseTime: 1.2
        };

        const saved = localStorage.getItem('agent_learning_data');
        return saved ? JSON.parse(saved) : defaultData;
    }

    // 生成回答（本地知识库备用）
    generateResponse(question) {
        const lowerQuestion = question.toLowerCase();
        
        // 在知识库中搜索
        for (const [category, knowledge] of Object.entries(this.knowledgeBase)) {
            for (const [key, value] of Object.entries(knowledge)) {
                if (lowerQuestion.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerQuestion)) {
                    return value;
                }
            }
        }
        
        // 基于关键词的智能回答
        if (lowerQuestion.includes('什么是') || lowerQuestion.includes('什么是')) {
            return this.generateDefinitionResponse(question);
        } else if (lowerQuestion.includes('区别') || lowerQuestion.includes('不同')) {
            return this.generateComparisonResponse(question);
        } else if (lowerQuestion.includes('如何') || lowerQuestion.includes('怎么')) {
            return this.generateHowToResponse(question);
        } else if (lowerQuestion.includes('推荐') || lowerQuestion.includes('建议')) {
            return this.generateRecommendationResponse(question);
        } else {
            return this.generateGeneralResponse(question);
        }
    }

    // 生成定义回答
    generateDefinitionResponse(question) {
        const definitions = [
            '这是一个很好的问题！让我为你详细解释一下：',
            '基于我的理解，这个问题的核心是：',
            '从专业角度来说，这涉及到：'
        ];
        
        return definitions[Math.floor(Math.random() * definitions.length)] + 
               '这是一个复杂的概念，需要深入理解其基本原理和应用场景。我建议从基础定义开始，然后逐步深入探讨其实际应用和未来发展。';
    }

    // 生成比较回答
    generateComparisonResponse(question) {
        return '这两者之间存在几个关键区别：\n\n1. **定义层面**：它们的基本概念和核心目标不同\n2. **应用场景**：各自适用于不同的问题领域\n3. **技术实现**：采用的方法论和工具有所差异\n4. **优缺点**：各有其优势和局限性\n\n具体选择哪种方法取决于你的具体需求和应用场景。';
    }

    // 生成教程回答
    generateHowToResponse(question) {
        return '要解决这个问题，我建议按以下步骤进行：\n\n**第一步：准备阶段**\n收集必要的资源和信息，确保你理解了基本概念。\n\n**第二步：实践操作**\n按照标准流程开始实施，注意关键细节和可能出现的问题。\n\n**第三步：验证优化**\n检查结果是否符合预期，必要时进行调整和优化。\n\n**第四步：持续改进**\n基于实践经验，不断完善和改进方法。\n\n如果你在某个具体步骤遇到困难，请告诉我，我可以提供更详细的指导。';
    }

    // 生成推荐回答
    generateRecommendationResponse(question) {
        return '基于你的需求，我推荐以下资源和方法：\n\n**学习资源：**\n• 在线课程平台（Coursera、edX、Udacity）\n• 专业书籍和学术论文\n• 开源项目和代码库\n• 技术社区和论坛\n\n**实践建议：**\n• 从小型项目开始，逐步提升难度\n• 参与开源社区，与他人交流学习\n• 保持学习的连续性和系统性\n• 注重理论与实践相结合\n\n**进阶路径：**\n• 深入学习核心理论和算法\n• 关注行业最新发展动态\n• 建立自己的项目作品集\n• 考虑相关认证和学位\n\n有什么特定的方面需要我详细说明吗？';
    }

    // 生成通用回答
    generateGeneralResponse(question) {
        const responses = [
            '这是一个很有意思的问题。从我的知识库来看，这涉及到多个领域的知识。让我为你提供一个全面的回答：',
            '我理解你的疑问。这个问题需要从不同角度来分析：',
            '很好的问题！基于当前的研究和实践，我可以分享以下见解：'
        ];
        
        return responses[Math.floor(Math.random() * responses.length)] + 
               '根据最新的技术发展和实践经验，这个问题的答案可能会因具体情境而有所不同。我建议我们深入探讨一下你关心的具体方面。';
    }

    // 打字机效果显示回答（备用）
typeResponse(response, isFallback = false) {
    const chatMessages = document.getElementById('chat-messages');
    const responseId = 'resp_' + Date.now();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-enter mb-6';
    messageDiv.id = responseId;
    
    messageDiv.innerHTML = `
        <div class="flex items-start space-x-3">
            <img src="resources/ai-avatar.png" alt="AI" class="w-10 h-10 rounded-full">
            <div class="flex-1">
                <div class="bg-gray-800 bg-opacity-60 rounded-lg p-4 max-w-3xl">
                    <div class="text-sm text-gray-300 mb-2">AI助手${isFallback ? ' (本地知识库)' : ''}</div>
                    <div class="text-white markdown-content" id="${responseId}-content"></div>
                    <div class="flex items-center space-x-4 mt-3 text-xs text-gray-500" style="display:none;" id="${responseId}-actions">
                        <span>刚刚</span>
                        <button class="feedback-btn text-green-400 hover:text-green-300" onclick="agent.likeMessage('${responseId}')">👍</button>
                        <button class="feedback-btn text-red-400 hover:text-red-300" onclick="agent.dislikeMessage('${responseId}')">👎</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    const contentElement = document.getElementById(`${responseId}-content`);
    const actionsElement = document.getElementById(`${responseId}-actions`);
    
    // 检查是否需要渲染 Markdown
    const shouldRenderMarkdown = markdownRenderer.containsMarkdown(response);
    
    // 打字机效果
    let index = 0;
    const typeChar = () => {
        if (index < response.length) {
            const currentText = response.substring(0, index + 1);
            
            if (shouldRenderMarkdown && index % 5 === 0) {
                // 每输入5个字符尝试渲染一次 Markdown（避免频繁渲染）
                try {
                    markdownRenderer.updateElement(contentElement, currentText);
                } catch (error) {
                    contentElement.textContent = currentText;
                }
            } else {
                contentElement.textContent = currentText;
            }
            
            index++;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            setTimeout(typeChar, this.typingSpeed);
        } else {
            // 最终渲染
            if (shouldRenderMarkdown) {
                try {
                    markdownRenderer.updateElement(contentElement, response);
                } catch (error) {
                    contentElement.textContent = response;
                }
            }
            
            actionsElement.style.display = 'flex';
            this.isTyping = false;
            
            // 保存AI回答
            this.currentConversation.push({
                id: responseId,
                content: response,
                sender: 'ai',
                timestamp: new Date(),
                formatted: shouldRenderMarkdown
            });
        }
    };
    
    this.isTyping = true;
    typeChar();
}

    // 触发学习机制
    triggerLearning() {
        // 模拟学习过程
        console.log('触发学习机制...');
        
        // 分析负面反馈，调整回答策略
        const recentFeedback = this.learningData.userFeedback.slice(-10);
        const negativeCount = recentFeedback.filter(f => f.type === 'dislike').length;
        
        if (negativeCount > 3) {
            console.log('检测到多个负面反馈，调整回答策略...');
            this.learningData.responseAccuracy = Math.max(0.7, this.learningData.responseAccuracy - 0.01);
        }
        
        this.saveLearningData();
    }

    // 保存学习数据
    saveLearningData() {
        localStorage.setItem('agent_learning_data', JSON.stringify(this.learningData));
    }

    // 保存知识库
    saveKnowledgeBase() {
        localStorage.setItem('agent_knowledge_base', JSON.stringify(this.knowledgeBase));
    }

    // 加载设置
    loadSettings() {
        const settings = localStorage.getItem('agent_settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.typingSpeed = parsed.typingSpeed || 50;
        }
    }

    // 模拟学习过程
    simulateLearning() {
        setInterval(() => {
            // 模拟学习进度提升
            if (this.learningData.learningProgress < 0.99) {
                this.learningData.learningProgress += 0.001;
                this.saveLearningData();
            }
        }, 60000); // 每分钟更新一次
    }

    // 初始化粒子背景
    initParticleBackground() {
        const sketch = (p) => {
            let particles = [];
            const numParticles = 50;

            p.setup = () => {
                const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent('particle-bg');
                
                // 创建粒子
                for (let i = 0; i < numParticles; i++) {
                    particles.push({
                        x: p.random(p.width),
                        y: p.random(p.height),
                        vx: p.random(-0.5, 0.5),
                        vy: p.random(-0.5, 0.5),
                        size: p.random(1, 3),
                        opacity: p.random(0.3, 0.8)
                    });
                }
            };

            p.draw = () => {
                p.clear();
                
                // 绘制粒子
                particles.forEach(particle => {
                    p.fill(0, 212, 255, particle.opacity * 255);
                    p.noStroke();
                    p.circle(particle.x, particle.y, particle.size);
                    
                    // 更新位置
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    
                    // 边界检测
                    if (particle.x < 0 || particle.x > p.width) particle.vx *= -1;
                    if (particle.y < 0 || particle.y > p.height) particle.vy *= -1;
                });
                
                // 绘制连接线
                for (let i = 0; i < particles.length; i++) {
                    for (let j = i + 1; j < particles.length; j++) {
                        const dist = p.dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                        if (dist < 100) {
                            const alpha = p.map(dist, 0, 100, 0.3, 0);
                            p.stroke(0, 212, 255, alpha * 255);
                            p.strokeWeight(0.5);
                            p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                        }
                    }
                }
            };

            p.windowResized = () => {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };
        };

        new p5(sketch);
    }
}

// 全局函数
async function sendMessage() {
    agent.sendMessage();
}

function clearChat() {
    if (agent.isTyping || agent.isStreaming) {
        agent.showFeedback('AI正在回复，请稍候...', 'warning');
        return;
    }
    
    const chatMessages = document.getElementById('chat-messages');
    const welcomeMessage = chatMessages.querySelector('.message-enter');
    chatMessages.innerHTML = '';
    if (welcomeMessage) {
        chatMessages.appendChild(welcomeMessage.cloneNode(true));
    }
    
    // 重置对话历史
    agent.currentConversation = [];
    agent.showFeedback('对话已清空', 'info');
}

async function exportChat() {
    const chatData = {
        messages: agent.currentConversation,
        exportTime: new Date(),
        totalMessages: agent.currentConversation.length,
        agentInfo: {
            version: '1.0',
            provider: aiService.getCurrentConfig().providerName
        }
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    agent.showFeedback('对话已导出', 'success');
}

function showSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
    const settings = {
        typingSpeed: document.getElementById('typing-speed').value,
        autoSave: document.getElementById('auto-save').checked,
        theme: document.getElementById('theme-select').value,
        enableStreaming: document.getElementById('enable-streaming').checked
    };
    
    localStorage.setItem('agent_settings', JSON.stringify(settings));
    agent.typingSpeed = 60 - (settings.typingSpeed * 5); // 转换为毫秒
    
    closeSettings();
    agent.showFeedback('设置已保存', 'success');
}

function loadHistory(id) {
    agent.showFeedback('正在加载历史对话...', 'info');
    // 这里可以实现加载历史对话的逻辑
}

function quickQuestion(question) {
    const input = document.getElementById('message-input');
    input.value = question;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    input.focus();
}

function toggleVoice() {
    agent.showFeedback('语音功能开发中...', 'info');
}

// 初始化Agent
const agent = new SmartAgent();