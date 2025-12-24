const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // 提供静态文件

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// 简单的日志端点（用于调试）
app.post('/api/log', (req, res) => {
    console.log('前端日志:', req.body);
    res.json({ received: true });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📁 静态文件服务已启用`);
});