package com.minidrive.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

	@Bean
	@Primary
	public DataSource dataSource() {
		HikariConfig config = new HikariConfig();

		// Environment Variables (Dynamic Config)
		String envDbUrl = System.getenv("DB_URL");
		String envDbUser = System.getenv("DB_USER");
		String envDbPass = System.getenv("DB_PASS");

		config.setJdbcUrl(envDbUrl != null && !envDbUrl.isEmpty()
				? envDbUrl : "jdbc:postgresql://localhost:5432/minidrive");
		config.setUsername(envDbUser != null ? envDbUser : "admin");
		config.setPassword(envDbPass != null ? envDbPass : "password123");

		config.setMaximumPoolSize(10);
		config.setMinimumIdle(2);
		config.setConnectionTimeout(30000);
		config.setIdleTimeout(600000);
		config.setMaxLifetime(1800000);

		return new HikariDataSource(config);
	}
}