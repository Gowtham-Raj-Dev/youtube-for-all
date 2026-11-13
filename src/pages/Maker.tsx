import { VIDEOMAKER_URL } from "../components/VideoCutModal";
import { StudioFrame } from "./Cut";

/**
 * Video Maker (videomaker.codelove.in) inside UTubeFlow: script → talking cartoon or text video.
 * "Add to Ready to Post" in its export panel sends the finished video here.
 */
export default function MakerPage() {
  return (
    <StudioFrame
      partner={{ name: "Video Maker", src: `${VIDEOMAKER_URL}/editor/?embed=utubeflow`, prefix: "videomaker", origin: "https://videomaker.codelove.in" }}
    />
  );
}
