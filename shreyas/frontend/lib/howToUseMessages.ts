import { Role } from "./types";
import {
  formatModuleResponse,
  getModuleResponse,
} from "./moduleResponses";

const getGuideMessage = (role: Role) => {
  const response = getModuleResponse(role, "guide");
  if (!response) return "Guide content is not available yet.";
  return formatModuleResponse(response);
};

export const howToUseMessages: Record<Role, string> = {
  parent: getGuideMessage("parent"),
  doctor: getGuideMessage("doctor"),
  nurse: getGuideMessage("nurse"),
};
