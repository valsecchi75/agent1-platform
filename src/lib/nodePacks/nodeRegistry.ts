import type { NodeTypes } from '@xyflow/react';

// Import all node components — compiled into the bundle
import {
  ImageInputNode,
  AudioInputNode,
  VideoInputNode,
  AnnotationNode,
  PromptNode,
  ArrayNode,
  PromptConstructorNode,
  GenerateImageNode,
  GenerateVideoNode,
  Generate3DNode,
  GenerateAudioNode,
  LLMGenerateNode,
  SplitGridNode,
  OutputNode,
  OutputGalleryNode,
  ImageCompareNode,
  VideoStitchNode,
  EaseCurveNode,
  VideoTrimNode,
  VideoFrameGrabNode,
  RouterNode,
  SwitchNode,
  ConditionalSwitchNode,
  NASketchToPhotoNode,
  NAStylingDetailNode,
  NARecolorNode,
  MorpheusModelManagementNode,
  PreviewImageNode,
  ShowAnythingNode,
} from '@/components/nodes';

/**
 * Static lookup: all components that COULD be registered.
 * Compiled into the bundle — dormant until their pack is installed.
 * NOTE: GLBViewerNode is lazy-loaded and must be added separately
 * in WorkflowCanvas.tsx via dynamic import.
 */
export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  imageInput: ImageInputNode,
  audioInput: AudioInputNode,
  videoInput: VideoInputNode,
  annotation: AnnotationNode,
  prompt: PromptNode,
  array: ArrayNode,
  promptConstructor: PromptConstructorNode,
  nanoBanana: GenerateImageNode,
  generateVideo: GenerateVideoNode,
  generate3d: Generate3DNode,
  generateAudio: GenerateAudioNode,
  llmGenerate: LLMGenerateNode,
  splitGrid: SplitGridNode,
  output: OutputNode,
  outputGallery: OutputGalleryNode,
  imageCompare: ImageCompareNode,
  videoStitch: VideoStitchNode,
  easeCurve: EaseCurveNode,
  videoTrim: VideoTrimNode,
  videoFrameGrab: VideoFrameGrabNode,
  router: RouterNode,
  switch: SwitchNode,
  conditionalSwitch: ConditionalSwitchNode,
  naSketchToPhoto: NASketchToPhotoNode,
  naStylingDetail: NAStylingDetailNode,
  naRecolor: NARecolorNode,
  morpheusModelManagement: MorpheusModelManagementNode,
  previewImage: PreviewImageNode,
  showAnything: ShowAnythingNode,
};

/**
 * Build the nodeTypes object for ReactFlow from a list of active type strings.
 * Only includes types that exist in COMPONENT_REGISTRY.
 */
export function buildNodeTypes(activeTypes: string[]): NodeTypes {
  const result: NodeTypes = {};
  for (const type of activeTypes) {
    const component = COMPONENT_REGISTRY[type];
    if (component) {
      result[type] = component;
    }
  }
  return result;
}
