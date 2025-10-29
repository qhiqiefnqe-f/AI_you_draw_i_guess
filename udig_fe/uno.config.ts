import { defineConfig, presetUno, presetAttributify, transformerDirectives } from 'unocss'

export default defineConfig({
  // 预设
  presets: [
    // 启用类 Tailwind 的通用工具类（flex、bg-、text-、w- 等）
    presetUno(),
    // 可选：支持属性化写法（如 flex="~"），暂不强制使用
    presetAttributify(),
  ],
  // 支持在 CSS 中使用 @apply 等指令（main.css 中大量使用）
  transformers: [
    transformerDirectives(),
  ],
  
  // 自定义规则
  rules: [
    // 自定义工具类
    ['btn-primary', {
      'background-color': '#3b82f6',
      'color': 'white',
      'padding': '0.5rem 1rem',
      'border-radius': '0.375rem',
      'border': 'none',
      'cursor': 'pointer',
      'font-weight': '500',
      'transition': 'all 0.2s',
    }],
    ['btn-primary:hover', {
      'background-color': '#2563eb',
    }],
    ['card', {
      'background-color': 'white',
      'border-radius': '0.5rem',
      'box-shadow': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      'padding': '1rem',
    }],
  ],
  
  // 快捷方式
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    'text-ellipsis': 'truncate',
  },
  
  // 主题
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
    }
  }
})