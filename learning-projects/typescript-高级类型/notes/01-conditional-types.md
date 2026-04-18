# 条件类型

## 什么是条件类型

条件类型是一种根据类型关系动态选择类型的机制。

- 类似于 JavaScript 中的三元表达式
- 使用 extends 关键字进行类型判断
- 可以实现复杂的类型推导

## 基本语法

```typescript
T extends U ? X : Y
```

## 示例

- `type IsString = T extends string ? true : false`
- `type NonNullable = T extends null | undefined ? never : T`

## 常见用法

- 类型守卫
- 类型提取
- 类型分发
