package com.minidrive;

import com.minidrive.service.DriveServiceImpl;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import java.io.IOException;

public class DriveServer {
	public static void main(String[] args) throws IOException, InterruptedException {
		int port = 50051;

		System.out.println("Starting MiniDrive Server on port " + port + "...");

		Server server = ServerBuilder.forPort(port)
				.addService(new DriveServiceImpl())
				.build()
				.start();

		System.out.println("Server started!");

		// Don't exit the main thread, keep listening
		server.awaitTermination();
	}
}