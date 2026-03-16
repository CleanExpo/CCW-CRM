/**
 * Centralized Error Handler
 *
 * Provides error classification, user-friendly messages, and logging.
 */

import { ApiClientError } from "@/lib/api/client";

export enum ErrorType {
  NETWORK = "NETWORK",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  VALIDATION = "VALIDATION",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMIT = "RATE_LIMIT",
  SERVER = "SERVER",
  UNKNOWN = "UNKNOWN",
}

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  shouldRetry: boolean;
  shouldReauth: boolean;
  statusCode?: number;
}

/**
 * Classify error and provide user-friendly message
 */
export function classifyError(error: unknown): ClassifiedError {
  // Network errors
  if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("network"))) {
    return {
      type: ErrorType.NETWORK,
      message: error.message,
      userMessage: "Network connection lost. Please check your internet connection.",
      shouldRetry: true,
      shouldReauth: false,
    };
  }

  // API client errors
  if (error instanceof ApiClientError) {
    const status = error.status;

    // 401 Unauthorized
    if (status === 401) {
      return {
        type: ErrorType.AUTHENTICATION,
        message: error.message,
        userMessage: "Your session has expired. Please log in again.",
        shouldRetry: false,
        shouldReauth: true,
        statusCode: status,
      };
    }

    // 403 Forbidden
    if (status === 403) {
      return {
        type: ErrorType.AUTHORIZATION,
        message: error.message,
        userMessage: "You don't have permission to perform this action.",
        shouldRetry: false,
        shouldReauth: false,
        statusCode: status,
      };
    }

    // 404 Not Found
    if (status === 404) {
      return {
        type: ErrorType.NOT_FOUND,
        message: error.message,
        userMessage: "The requested resource was not found.",
        shouldRetry: false,
        shouldReauth: false,
        statusCode: status,
      };
    }

    // 422 Validation Error
    if (status === 422) {
      return {
        type: ErrorType.VALIDATION,
        message: error.message,
        userMessage: error.message || "Please check your input and try again.",
        shouldRetry: false,
        shouldReauth: false,
        statusCode: status,
      };
    }

    // 429 Rate Limit
    if (status === 429) {
      return {
        type: ErrorType.RATE_LIMIT,
        message: error.message,
        userMessage: "Too many requests. Please wait a moment and try again.",
        shouldRetry: true,
        shouldReauth: false,
        statusCode: status,
      };
    }

    // 5xx Server Errors
    if (status >= 500) {
      return {
        type: ErrorType.SERVER,
        message: error.message,
        userMessage: "Server error. Our team has been notified. Please try again later.",
        shouldRetry: true,
        shouldReauth: false,
        statusCode: status,
      };
    }
  }

  // Unknown error
  return {
    type: ErrorType.UNKNOWN,
    message: error instanceof Error ? error.message : String(error),
    userMessage: "Something went wrong. Please try again.",
    shouldRetry: false,
    shouldReauth: false,
  };
}

/**
 * Log error to console (development) or monitoring service (production)
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const classified = classifyError(error);

  if (process.env.NODE_ENV === "development") {
    console.error("[Error Handler]", {
      type: classified.type,
      message: classified.message,
      context,
    });
  } else {
    // In production, send to monitoring service (e.g., Sentry, LogRocket)
    // TODO: Integrate with monitoring service
    console.error(classified.message, context);
  }
}

/**
 * Handle error and decide action
 */
export function handleError(error: unknown, context?: Record<string, any>): ClassifiedError {
  const classified = classifyError(error);

  // Log the error
  logError(error, context);

  // Handle re-authentication if needed
  if (classified.shouldReauth && typeof window !== "undefined") {
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);
  }

  return classified;
}
