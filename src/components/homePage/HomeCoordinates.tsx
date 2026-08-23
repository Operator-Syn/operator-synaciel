import PointerCoordinates from "../pointerCoordinates/PointerCoordinates";
import type { HomeSectionIndex } from "./useHomepageMotion";

interface HomeCoordinatesProps {
  activeSection: HomeSectionIndex;
}

export default function HomeCoordinates({ activeSection }: HomeCoordinatesProps) {
  return <PointerCoordinates activeSection={activeSection} className="homepage-coordinates" />;
}
