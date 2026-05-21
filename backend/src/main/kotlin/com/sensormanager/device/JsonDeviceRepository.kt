package com.sensormanager.device

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Repository

@Repository
class JsonDeviceRepository(private val objectMapper: ObjectMapper) : DeviceRepository {

    private val cached: List<Device> by lazy {
        ClassPathResource("data/devices.json").inputStream.use { input ->
            objectMapper.readValue(input)
        }
    }

    override fun findAll(): List<Device> = cached
}
