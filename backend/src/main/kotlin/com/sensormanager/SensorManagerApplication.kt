package com.sensormanager

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class SensorManagerApplication

fun main(args: Array<String>) {
    runApplication<SensorManagerApplication>(*args)
}
