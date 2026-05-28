package com.sensormanager.device

import java.time.Instant

data class Device(
    val hwid: String,
    val currentLocationId: Int?,
    val currentLocationName: String?,
    val firstSeenAt: Instant?,
    val lastSeenAt: Instant?,
)
