// Markdown 渲染器类
class MarkdownRenderer {
    constructor() {
        this.initMarked();
    }

    // 初始化 marked 配置
    initMarked() {
        marked.setOptions({
            breaks: true,      // 换行转换为 <br>
            gfm: true,         // 支持 GitHub Flavored Markdown
            sanitize: false,   // 不清理 HTML（我们需要渲染数学公式）
            highlight: this.highlightCode.bind(this)
        });

        // 自定义渲染器
        const renderer = new marked.Renderer();

        // 重写代码块渲染
        renderer.code = (code, language, isEscaped) => {
            const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
            const highlighted = hljs.highlight(code, { language: validLanguage }).value;
            return `<pre class="hljs"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
        };

        // 重写行内代码渲染
        renderer.codespan = (text) => {
            return `<code class="inline-code">${text}</code>`;
        };

        // 重写段落渲染，支持数学公式
        renderer.paragraph = (text) => {
            // 检查是否是数学公式块
            if (text.startsWith('$$') && text.endsWith('$$')) {
                const mathContent = text.substring(2, text.length - 2);
                try {
                    return `<div class="math-block">${katex.renderToString(mathContent, { displayMode: true })}</div>`;
                } catch (error) {
                    console.error('KaTeX 渲染错误:', error);
                    return `<p>${text}</p>`;
                }
            }
            return `<p>${text}</p>`;
        };

        // 设置自定义渲染器
        marked.use({ renderer });
    }

    // 代码高亮函数
    highlightCode(code, language) {
        const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
        try {
            return hljs.highlight(code, { language: validLanguage }).value;
        } catch (error) {
            return hljs.highlight(code, { language: 'plaintext' }).value;
        }
    }

    // 渲染 Markdown 为 HTML
    render(markdownText) {
        // 预处理：处理数学公式
        let processedText = this.preprocessMath(markdownText);
        
        // 渲染 Markdown
        let html = marked.parse(processedText);
        
        // 后处理：渲染行内数学公式
        html = this.renderInlineMath(html);
        
        return html;
    }

    // 预处理数学公式
    preprocessMath(text) {
        // 处理行内数学公式 $...$
        text = text.replace(/\$([^$]+)\$/g, (match, math) => {
            return `$math-inline$${math}$math-inline$`;
        });

        // 处理块级数学公式 $$...$$
        text = text.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
            return `\n$$${math}$$\n`;
        });

        return text;
    }

    // 渲染行内数学公式
    renderInlineMath(html) {
        // 查找行内数学公式占位符
        const inlineMathRegex = /\$math-inline\$([^$]+)\$math-inline\$/g;
        
        return html.replace(inlineMathRegex, (match, math) => {
            try {
                return katex.renderToString(math, { 
                    displayMode: false,
                    throwOnError: false
                });
            } catch (error) {
                console.error('行内公式渲染错误:', error);
                return `$${math}$`;
            }
        });
    }

    // 渲染块级数学公式（单独处理）
    renderBlockMath(element) {
        const mathBlocks = element.querySelectorAll('.math-block');
        mathBlocks.forEach(block => {
            const mathContent = block.textContent;
            try {
                block.innerHTML = katex.renderToString(mathContent, { 
                    displayMode: true,
                    throwOnError: false
                });
            } catch (error) {
                console.error('块级公式渲染错误:', error);
            }
        });
    }

    // 更新元素内容（实时渲染）
    updateElement(element, markdownText) {
        // 如果文本是纯文本（没有 Markdown 格式），直接显示
        if (!this.containsMarkdown(markdownText)) {
            element.textContent = markdownText;
            return;
        }

        // 否则渲染 Markdown
        const html = this.render(markdownText);
        element.innerHTML = html;
        
        // 渲染块级数学公式
        this.renderBlockMath(element);
        
        // 应用代码高亮
        element.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    // 检查是否包含 Markdown 格式
    containsMarkdown(text) {
        const markdownPatterns = [
            /#+\s/,               // 标题
            /\*\*[^*]+\*\*/,      // 加粗
            /\*[^*]+\*/,          // 斜体
            /`[^`]+`/,            // 行内代码
            /```[\s\S]*```/,      // 代码块
            /\[[^\]]+\]\([^)]+\)/, // 链接
            /!\[[^\]]+\]\([^)]+\)/, // 图片
            /^- /,                // 无序列表
            /\$\$[\s\S]*\$\$/,    // 块级数学公式
            /\$[^$]+\$/,          // 行内数学公式
            />\s/,                // 引用
            /^\|.*\|$/m,          // 表格
            /---/,                // 水平线
            /\n\s*\n/,            // 多个空行
        ];

        return markdownPatterns.some(pattern => pattern.test(text));
    }

    // 简单的 Markdown 转纯文本（用于预览）
    toPlainText(markdownText) {
        // 移除 Markdown 标记
        let plainText = markdownText
            .replace(/^#+\s+/gm, '')          // 移除标题
            .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除加粗
            .replace(/\*([^*]+)\*/g, '$1')     // 移除斜体
            .replace(/`([^`]+)`/g, '$1')       // 移除行内代码
            .replace(/```[\s\S]*```/g, '')     // 移除代码块
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接
            .replace(/!\[[^\]]+\]\([^)]+\)/g, '') // 移除图片
            .replace(/^\s*[-*+]\s+/gm, '')     // 移除列表标记
            .replace(/\$\$[\s\S]*\$\$/g, '')   // 移除块级数学公式
            .replace(/\$([^$]+)\$/g, '$1')     // 移除行内数学公式
            .replace(/^\s*>\s+/gm, '')         // 移除引用标记
            .replace(/\n{3,}/g, '\n\n');       // 合并多个空行

        return plainText.trim();
    }
}

// 创建全局 Markdown 渲染器实例
const markdownRenderer = new MarkdownRenderer();