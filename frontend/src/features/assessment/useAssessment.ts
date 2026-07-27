'use client';

import { useReducer } from 'react';
import type { ClassificationResult, Questionnaire, SkinContext } from './types';

export type AssessmentPhase =
  | 'idle'
  | 'selectingImage'
  | 'uploading'
  | 'classifying'
  | 'collectingSymptoms'
  | 'generatingRecommendation'
  | 'completed'
  | 'requiresReview'
  | 'failed';

export interface AssessmentFlowState {
  phase: AssessmentPhase;
  data: {
    assessmentId: string | null;
    imageFile: File | null;
    imagePreviewUrl: string | null;
    classificationResult: ClassificationResult | null;
    questionnaire: Questionnaire | null;
    skinContext: SkinContext | null;
    error: string | null;
  };
}

export type AssessmentAction =
  | { type: 'reset'; assessmentId?: string | null }
  | { type: 'setAssessmentId'; assessmentId: string }
  | { type: 'startImageSelection' }
  | { type: 'selectImage'; file: File; previewUrl: string }
  | { type: 'clearImage' }
  | { type: 'startUploading' }
  | { type: 'startClassifying' }
  | { type: 'startCollectingSymptoms' }
  | { type: 'startGeneratingRecommendation' }
  | { type: 'markCompleted'; classificationResult?: ClassificationResult }
  | { type: 'markRequiresReview' }
  | { type: 'markFailed'; error: string }
  | { type: 'setQuestionnaire'; questionnaire: Questionnaire }
  | { type: 'setSkinContext'; skinContext: SkinContext }
  | { type: 'setClassificationResult'; classificationResult: ClassificationResult }
  | { type: 'clearError' };

function createInitialState(assessmentId: string | null = null): AssessmentFlowState {
  return {
    phase: 'idle',
    data: {
      assessmentId,
      imageFile: null,
      imagePreviewUrl: null,
      classificationResult: null,
      questionnaire: null,
      skinContext: null,
      error: null,
    },
  };
}

function assessmentReducer(state: AssessmentFlowState, action: AssessmentAction): AssessmentFlowState {
  switch (action.type) {
    case 'reset':
      return createInitialState(action.assessmentId ?? state.data.assessmentId);
    case 'setAssessmentId':
      return {
        ...state,
        data: {
          ...state.data,
          assessmentId: action.assessmentId,
        },
      };
    case 'startImageSelection':
      return {
        ...state,
        phase: 'selectingImage',
        data: {
          ...state.data,
          error: null,
        },
      };
    case 'selectImage':
      return {
        ...state,
        phase: 'selectingImage',
        data: {
          ...state.data,
          imageFile: action.file,
          imagePreviewUrl: action.previewUrl,
          error: null,
        },
      };
    case 'clearImage':
      return {
        ...state,
        phase: 'idle',
        data: {
          ...state.data,
          imageFile: null,
          imagePreviewUrl: null,
          classificationResult: null,
          error: null,
        },
      };
    case 'startUploading':
      return { ...state, phase: 'uploading', data: { ...state.data, error: null } };
    case 'startClassifying':
      return { ...state, phase: 'classifying', data: { ...state.data, error: null } };
    case 'startCollectingSymptoms':
      return { ...state, phase: 'collectingSymptoms', data: { ...state.data, error: null } };
    case 'startGeneratingRecommendation':
      return { ...state, phase: 'generatingRecommendation', data: { ...state.data, error: null } };
    case 'markCompleted':
      return {
        ...state,
        phase: 'completed',
        data: {
          ...state.data,
          classificationResult: action.classificationResult ?? state.data.classificationResult,
          error: null,
        },
      };
    case 'markRequiresReview':
      return { ...state, phase: 'requiresReview', data: { ...state.data, error: null } };
    case 'markFailed':
      return { ...state, phase: 'failed', data: { ...state.data, error: action.error } };
    case 'setQuestionnaire':
      return { ...state, data: { ...state.data, questionnaire: action.questionnaire } };
    case 'setSkinContext':
      return { ...state, data: { ...state.data, skinContext: action.skinContext } };
    case 'setClassificationResult':
      return {
        ...state,
        data: {
          ...state.data,
          classificationResult: action.classificationResult,
        },
      };
    case 'clearError':
      return { ...state, data: { ...state.data, error: null } };
    default:
      return state;
  }
}

export function useAssessment(initialAssessmentId: string | null = null) {
  const [state, dispatch] = useReducer(assessmentReducer, createInitialState(initialAssessmentId));

  return {
    state,
    phase: state.phase,
    data: state.data,
    dispatch,
    transition: dispatch,
  };
}
