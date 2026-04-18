# Rust 所有权机制

## 1. 所有权基础

所有权是 Rust 最独特的特性，它让 Rust 无需垃圾回收器即可保证内存安全。

### 三条核心规则

1. Rust 中每个值都有一个所有者（owner）
2. 同一时刻只能有一个所有者
3. 当所有者离开作用域，值将被丢弃

```rust
let s1 = String::from("hello");
let s2 = s1; // s1 的所有权转移给 s2
// println!("{}", s1); // 错误！s1 已无效
println!("{}", s2); // 正确
```

## 2. 借用与引用

### 不可变引用

```rust
fn calculate_length(s: &String) -> usize {
    s.len()
} // s 离开作用域，但因为它只是引用，不丢弃数据

let s1 = String::from("hello");
let len = calculate_length(&s1);
```

### 可变引用

```rust
fn append(s: &mut String) {
    s.push_str(", world");
}

let mut s = String::from("hello");
append(&mut s);
```

### 引用规则

1. 可以有多个不可变引用，或者一个可变引用
2. 引用必须总是有效的（不能有悬垂引用）

## 3. 生命周期

生命周期标注用于告诉编译器引用的有效范围。

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

## 4. 切片类型

切片是引用集合中一段连续元素的引用。

```rust
let s = String::from("hello world");
let hello = &s[0..5]; // "hello"
let world = &s[6..11]; // "world"
```

## 总结

所有权系统是 Rust 内存安全的基石：
- 所有权转移（move）
- 借用（borrow）
- 生命周期标注
