import type { DeviceIconKey } from "../shared/types";
import { deviceIconOptions } from "../shared/deviceIcons";
import accessPointIcon from "./assets/device-icons/access-point.svg";
import bladeChassisIcon from "./assets/device-icons/blade-chassis.svg";
import firewallIcon from "./assets/device-icons/firewall.svg";
import genericDeviceIcon from "./assets/device-icons/generic-device.svg";
import kvmIcon from "./assets/device-icons/kvm.svg";
import loadBalancerIcon from "./assets/device-icons/load-balancer.svg";
import mediaConverterIcon from "./assets/device-icons/media-converter.svg";
import modemIcon from "./assets/device-icons/modem.svg";
import nasIcon from "./assets/device-icons/nas.svg";
import patchPanelIcon from "./assets/device-icons/patch-panel.svg";
import pduVerticalIcon from "./assets/device-icons/pdu-vertical.svg";
import routerIcon from "./assets/device-icons/router.svg";
import serverIcon from "./assets/device-icons/server.svg";
import storageIcon from "./assets/device-icons/storage.svg";
import switchIcon from "./assets/device-icons/switch.svg";
import terminalServerIcon from "./assets/device-icons/terminal-server.svg";
import upsIcon from "./assets/device-icons/ups.svg";

export const deviceIconUrlByKey: Record<DeviceIconKey, string> = {
  "generic-device": genericDeviceIcon,
  server: serverIcon,
  switch: switchIcon,
  router: routerIcon,
  "patch-panel": patchPanelIcon,
  "pdu-vertical": pduVerticalIcon,
  storage: storageIcon,
  firewall: firewallIcon,
  ups: upsIcon,
  modem: modemIcon,
  "access-point": accessPointIcon,
  kvm: kvmIcon,
  "blade-chassis": bladeChassisIcon,
  "load-balancer": loadBalancerIcon,
  "media-converter": mediaConverterIcon,
  "terminal-server": terminalServerIcon,
  nas: nasIcon
};

export { deviceIconOptions };

export function getDeviceIconUrl(iconKey: DeviceIconKey | null | undefined): string {
  return deviceIconUrlByKey[iconKey ?? "generic-device"] ?? genericDeviceIcon;
}
