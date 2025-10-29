// 全局类型声明文件

// 扩展Window接口
declare global {
  interface Window {
    __APP__?: any;
  }
}

// Vue组件类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// UnoCSS虚拟模块声明
declare module 'virtual:uno.css' {
  const css: string
  export default css
}

// UnoCSS标准模块声明
declare module 'uno.css' {
  const css: string
  export default css
}

export {}