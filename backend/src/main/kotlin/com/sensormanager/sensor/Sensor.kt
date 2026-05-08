package com.sensormanager.sensor

import java.time.Instant
import java.util.UUID

data class Sensor(
    val id: UUID,
    val name: String,
    val location: String?,
    val online: Boolean,
    val lastSeenAt: Instant?,
)
