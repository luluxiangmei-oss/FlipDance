/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VideoAsset {
  url: string;
  name: string;
  duration?: number;
  width?: number;
  height?: number;
  isDemo?: boolean;
}

export interface PlayerControls {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isMirrored: boolean;
  isMainSwapped: boolean; // Active state: whether original is main and mirrored is in PIP, or vice versa
}

export interface DemoVideo {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  coverUrl: string;
}
