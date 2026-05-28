package com.sensormanager.reading

/**
 * Query-shaped read model for sensor readings.
 *
 * Methods are intentionally tailored to what the landing page needs rather than
 * exposing raw rows. When we replace the JSON-backed impl with a JDBC one, each
 * method will translate to a single SQL query (likely against materialized
 * views) so callers don't need to change.
 */
interface ReadingRepository {
    fun latestPerLocation(): List<LatestReading>
    fun temperatureTrend(): List<TemperatureTrendPoint>
    fun co2Summary(): List<Co2SummaryPoint>
}
