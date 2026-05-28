package com.sensormanager.stats

import java.time.Instant

/** Top-line totals for the landing-page hero section. */
data class SensorStats(
    val deviceCount: Int,
    val locationCount: Int,
    val readingCount: Long,
    val earliestReadingAt: Instant,
    val latestReadingAt: Instant,
)
