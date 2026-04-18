# Composition API 基础

## 1. Composition API 简介

Composition API 是 Vue 3 引入的一组新 API，它允许我们使用函数而不是声明式选项来组织组件逻辑。相比 Options API，Composition API 提供了更好的逻辑复用和代码组织能力。

主要优势：
- 更好的 TypeScript 支持
- 更灵活的代码组织
- 更容易提取和复用逻辑
- 更小的打包体积

## 2. setup 函数

`setup` 是 Composition API 的入口函数，在组件创建前执行。它接收两个参数：
- `props` - 响应式的父组件传递的 props
- `context` - 包含 attrs、slots、emit、expose 的普通对象

```javascript
export default {
  setup(props, context) {
    // 在这里编写组合式逻辑
    return {
      // 返回的对象属性可在模板中使用
    }
  }
}
```

setup 函数的特点：
- 在 beforeCreate 钩子之前执行
- this 不可用（因为组件实例尚未创建）
- 返回的对象属性可以在模板中直接使用
- 可以与 Options API 混用

## 3. ref 和 reactive

### ref
`ref` 用于创建一个响应式引用，可以包裹任何类型的值。

```javascript
import { ref } from 'vue'

const count = ref(0)
console.log(count.value) // 0
count.value++ // 需要通过 .value 访问
```

### reactive
`reactive` 用于创建一个响应式对象，返回原始对象的 Proxy。

```javascript
import { reactive } from 'vue'

const state = reactive({
  count: 0,
  name: 'Vue'
})
state.count++ // 直接访问，无需 .value
```

### ref vs reactive 的区别

| 特性 | ref | reactive |
|------|-----|----------|
| 适用类型 | 任何类型 | 仅对象类型 |
| 访问方式 | 需要 .value | 直接访问 |
| 解包 | 模板中自动解包 | 无需解包 |
| 重新赋值 | 可以整体替换 | 不能整体替换 |
| 适用场景 | 基础类型、需要重新赋值 | 复杂对象、不需要替换整个对象 |

推荐使用原则：
- 对于基本类型，使用 ref
- 对于对象类型，如果需要重新赋值整个对象，使用 ref
- 对于对象类型，如果只是修改属性，使用 reactive

## 4. computed 和 watch

### computed
`computed` 用于创建计算属性，具有缓存特性。

```javascript
import { ref, computed } from 'vue'

const count = ref(1)
const doubleCount = computed(() => count.value * 2)

console.log(doubleCount.value) // 2
```

### watch
`watch` 用于侦听响应式数据变化并执行副作用。

```javascript
import { ref, watch } from 'vue'

const count = ref(0)

watch(count, (newValue, oldValue) => {
  console.log(`count 从 ${oldValue} 变为 ${newValue}`)
})

count.value++ // 触发 watch 回调
```

### watchEffect
`watchEffect` 自动追踪回调中的响应式依赖。

```javascript
import { ref, watchEffect } from 'vue'

const count = ref(0)

watchEffect(() => {
  console.log(`当前 count 值: ${count.value}`)
}) // 立即执行一次

count.value++ // 自动追踪并触发
```

## 总结

Composition API 通过 setup 函数、ref/reactive 响应式系统、computed/watch 等工具函数，提供了更灵活的组件逻辑组织方式。掌握这些基础知识是深入理解 Vue 3 的关键。
