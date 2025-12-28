package com.minidrive;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SanchayCloudApp {
	public static void main(String[] args) {
		// This starts Tomcat on port 8080
		SpringApplication.run(SanchayCloudApp.class, args);

		// Note: To run gRPC simultaneously, you'd start the gRPC server in a separate thread here.
	}
}