package com.sensormanager.device

import com.fasterxml.jackson.databind.ObjectMapper
import com.sensormanager.common.loadClasspathJson
import org.springframework.stereotype.Repository

@Repository
internal class JsonDeviceRepository(objectMapper: ObjectMapper) : DeviceRepository {

    private val cached: List<Device> = loadClasspathJson(objectMapper, "data/devices.json")

    override fun findAll(): List<Device> = cached
}
