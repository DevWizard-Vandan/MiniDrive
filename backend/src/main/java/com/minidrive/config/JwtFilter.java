package com.minidrive.config;

import com.minidrive.auth.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtFilter extends OncePerRequestFilter {

	@Autowired
	private AuthService authService;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {

		String token = null;
		String authHeader = request.getHeader("Authorization");

		// 1. Try to get token from Header
		if (authHeader != null && authHeader.startsWith("Bearer ")) {
			token = authHeader.substring(7);
		}
		// 2. Fallback: Try to get token from Query Parameter (For Images/Videos)
		else if (request.getParameter("token") != null) {
			token = request.getParameter("token");
		}

		// 3. Validate Token
		if (token != null) {
			String username = authService.validateTokenAndGetUsername(token);

			if (username != null) {
				UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
						username, null, Collections.emptyList());
				SecurityContextHolder.getContext().setAuthentication(auth);
			}
		}

		filterChain.doFilter(request, response);
	}
}