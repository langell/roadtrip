import { GooglePlacesUpstreamError } from '../services/google-places-service.js';
import { AiTripPlannerError } from '../services/ai-trip-planner-service.js';

export const toPlacesErrorMeta = (error: unknown) => {
  if (error instanceof GooglePlacesUpstreamError) {
    return { code: error.message, stage: error.stage, details: error.details };
  }
  return {
    code: 'UNKNOWN_PLACES_ERROR',
    stage: 'unknown',
    details: { message: String(error) },
  };
};

export const toAiPlannerErrorMeta = (error: unknown) => {
  if (error instanceof AiTripPlannerError) {
    return { code: error.message, stage: error.stage, details: error.details };
  }
  return {
    code: 'UNKNOWN_AI_PLANNER_ERROR',
    stage: 'unknown',
    details: { message: String(error) },
  };
};
