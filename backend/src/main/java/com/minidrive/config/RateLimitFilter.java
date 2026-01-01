package com.minidrive.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Simple in-memory rate limiting filter.
 * Limits requests per IP/user for sensitive endpoints.
 */
@Component
public class RateLimitFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    // IP -> request count map (cleared every minute)
    private final Map<String, RateBucket> ipBuckets = new ConcurrentHashMap<>();
    
    // Rate limits
    private static final int LOGIN_LIMIT = 5;        // 5 attempts per minute
    private static final int UPLOAD_LIMIT = 100;     // 100 chunks per minute
    private static final int DEFAULT_LIMIT = 200;    // 200 requests per minute
    
    private long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL = 60_000; // 1 minute

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;
        
        String path = req.getRequestURI();
        String ip = getClientIP(req);
        
        // Cleanup old buckets periodically
        cleanupIfNeeded();
        
        // Determine rate limit based on endpoint
        int limit = DEFAULT_LIMIT;
        String bucketKey = ip;
        
        if (path.contains("/auth/login")) {
            limit = LOGIN_LIMIT;
            bucketKey = ip + ":login";
        } else if (path.contains("/upload/chunk")) {
            limit = UPLOAD_LIMIT;
            bucketKey = ip + ":upload";
        }
        
        // Check rate limit
        RateBucket bucket = ipBuckets.computeIfAbsent(bucketKey, k -> new RateBucket());
        
        if (bucket.incrementAndCheck(limit)) {
            chain.doFilter(request, response);
        } else {
            log.warn("⚠️ Rate limit exceeded for {} on {}", ip, path);
            res.setStatus(429);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"Too many requests. Please wait and try again.\"}");
        }
    }

    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void cleanupIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup > CLEANUP_INTERVAL) {
            ipBuckets.clear();
            lastCleanup = now;
        }
    }

    /**
     * Simple rate bucket with atomic counter.
     */
    private static class RateBucket {
        private final AtomicInteger count = new AtomicInteger(0);

        boolean incrementAndCheck(int limit) {
            return count.incrementAndGet() <= limit;
        }
    }
}
