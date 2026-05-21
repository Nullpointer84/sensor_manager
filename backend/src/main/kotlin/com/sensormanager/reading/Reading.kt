package com.sensormanager.reading

import java.time.Instant
import java.time.LocalDate

/** Latest reading visible at a single location. Any sensor value may be null
 *  if the device assigned to that location doesn't report it. */
data class LatestReading(
    val locationId: Int,
    val locationName: String,
    val deviceHwid: String?,
    val timestamp: Instant?,
    val indoorTempC: Double?,
    val humidityPct: Double?,
    val pressureHpa: Double?,
    val co2Ppm: Double?,
    val breathVoc: Double?,
    val iaqStatic: Double?,
)

/** One day of indoor temperature aggregated for one location. */
data class TemperatureTrendPoint(
    val date: LocalDate,
    val locationId: Int,
    val locationName: String,
    val meanTempC: Double,
    val minTempC: Double,
    val maxTempC: Double,
)

/** One day of CO2 aggregated for one location. */
data class Co2SummaryPoint(
    val date: LocalDate,
    val locationId: Int,
    val locationName: String,
    val meanCo2Ppm: Double,
    val peakCo2Ppm: Double,
)
