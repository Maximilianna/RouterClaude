package com.routerclaude;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RouterClaudeApplication {

    public static void main(String[] args) {
        SpringApplication.run(RouterClaudeApplication.class, args);
    }
}
