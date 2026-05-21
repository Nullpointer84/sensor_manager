package com.sensormanager.location

import java.time.Instant

data class Location(
    val id: Int,
    val name: String,
    val description: String?,
    val currentDeviceHwid: String?,
    val currentDeviceSince: Instant?,
)
