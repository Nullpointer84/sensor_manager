package com.sensormanager.sensor

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/sensors")
class SensorController {

    @GetMapping
    fun list(): List<Sensor> = listOf(
        Sensor(
            id = UUID.fromString("00000000-0000-0000-0000-000000000001"),
            name = "example-sensor",
            location = "lab",
            online = true,
            lastSeenAt = Instant.now(),
        ),
    )
}
