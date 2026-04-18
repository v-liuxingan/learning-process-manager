# Goroutine 基础

## 1. Goroutine 概念

Goroutine 是 Go 语言中的轻量级线程，由 Go 运行时（runtime）管理。与操作系统线程相比，goroutine 的创建和销毁开销极小，初始栈大小仅为 2KB（可动态增长），而线程通常需要 1MB 以上。

## 2. Goroutine 创建语法

```go
// 基本语法
go functionName()

// 匿名函数
go func() {
    // 函数体
}()

// 带参数的匿名函数
go func(msg string) {
    fmt.Println(msg)
}("hello")
```

## 3. Goroutine 示例代码

### 示例 1: 基本使用

```go
package main

import (
    "fmt"
    "time"
)

func sayHello() {
    fmt.Println("Hello from goroutine!")
}

func main() {
    go sayHello()  // 启动一个新的 goroutine

    fmt.Println("Hello from main!")

    // 等待 goroutine 执行完成
    time.Sleep(100 * time.Millisecond)
}
```

### 示例 2: 并发执行

```go
package main

import (
    "fmt"
    "sync"
)

func printNumbers(wg *sync.WaitGroup, id int) {
    defer wg.Done()
    for i := 0; i < 5; i++ {
        fmt.Printf("Goroutine %d: %d\n", id, i)
    }
}

func main() {
    var wg sync.WaitGroup

    for i := 1; i <= 3; i++ {
        wg.Add(1)
        go printNumbers(&wg, i)
    }

    wg.Wait()
    fmt.Println("All goroutines finished")
}
```

## 4. 关键特性

- **轻量级**: 初始栈仅 2KB，可动态伸缩
- **调度由 Go 运行时管理**: M:N 模型
- **通信机制**: 推荐使用 channel 进行 goroutine 间通信
- **GOMAXPROCS**: 控制使用的操作系统线程数
