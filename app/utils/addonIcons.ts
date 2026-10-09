import type { Component } from "vue";
import {
  IconAperture,
  IconArmchair,
  IconBackground,
  IconBolt,
  IconBrush,
  IconBulb,
  IconCake,
  IconCamera,
  IconCloud,
  IconCoffee,
  IconConfetti,
  IconCookie,
  IconCrown,
  IconDeviceAudioTape,
  IconDeviceLaptop,
  IconDeviceProjector,
  IconDeviceTv,
  IconDiamond,
  IconFlower,
  IconFrame,
  IconGift,
  IconGlass,
  IconHanger,
  IconHeadphones,
  IconHeart,
  IconLamp,
  IconLeaf,
  IconClock,
  IconMicrophone,
  IconMovie,
  IconMusic,
  IconPackage,
  IconPalette,
  IconParking,
  IconPhoto,
  IconPhotoEdit,
  IconPlug,
  IconPrinter,
  IconScissors,
  IconShirt,
  IconShoe,
  IconSofa,
  IconSparkles,
  IconStar,
  IconSun,
  IconToolsKitchen2,
  IconUser,
  IconUsers,
  IconVideo,
  IconWand,
  IconWifi,
  IconWind,
} from "@tabler/icons-vue";

export type AddonIconCategory =
  | "team"
  | "equipment"
  | "lighting"
  | "props"
  | "wardrobe"
  | "facility";

type AddonIconOption = {
  value: string;
  label: string;
  icon: Component;
  category: AddonIconCategory;
};

// Urutan kategori = urutan tampil di pemilih ikon.
export const ADDON_ICON_CATEGORY_LABELS: Record<AddonIconCategory, string> = {
  team: "Tim & layanan",
  equipment: "Peralatan foto & video",
  lighting: "Cahaya & efek",
  props: "Properti & dekorasi",
  wardrobe: "Wardrobe & aksesori",
  facility: "Konsumsi & fasilitas",
};

export const DEFAULT_ADDON_ICON_OPTION = {
  value: "IconSparkles",
  label: "Kilau",
  icon: IconSparkles,
  category: "lighting",
} as const;

export const ADDON_ICON_OPTIONS = [
  // Tim & layanan
  { value: "IconCamera", label: "Kamera", icon: IconCamera, category: "team" },
  { value: "IconVideo", label: "Video", icon: IconVideo, category: "team" },
  { value: "IconMovie", label: "Film", icon: IconMovie, category: "team" },
  { value: "IconWand", label: "Makeup & styling", icon: IconWand, category: "team" },
  { value: "IconBrush", label: "Makeup artist", icon: IconBrush, category: "team" },
  { value: "IconScissors", label: "Hair stylist", icon: IconScissors, category: "team" },
  { value: "IconPhotoEdit", label: "Retouch & edit", icon: IconPhotoEdit, category: "team" },
  { value: "IconUser", label: "Asisten", icon: IconUser, category: "team" },
  { value: "IconUsers", label: "Tim / kru", icon: IconUsers, category: "team" },

  // Peralatan foto & video
  { value: "IconAperture", label: "Lensa", icon: IconAperture, category: "equipment" },
  { value: "IconDeviceLaptop", label: "Tethering / laptop", icon: IconDeviceLaptop, category: "equipment" },
  { value: "IconDeviceTv", label: "Monitor / TV", icon: IconDeviceTv, category: "equipment" },
  { value: "IconDeviceProjector", label: "Proyektor", icon: IconDeviceProjector, category: "equipment" },
  { value: "IconMicrophone", label: "Mikrofon", icon: IconMicrophone, category: "equipment" },
  { value: "IconHeadphones", label: "Headphone", icon: IconHeadphones, category: "equipment" },
  { value: "IconDeviceAudioTape", label: "Audio", icon: IconDeviceAudioTape, category: "equipment" },
  { value: "IconMusic", label: "Musik", icon: IconMusic, category: "equipment" },
  { value: "IconPrinter", label: "Cetak foto", icon: IconPrinter, category: "equipment" },
  { value: "IconPlug", label: "Listrik tambahan", icon: IconPlug, category: "equipment" },
  { value: "IconWifi", label: "WiFi", icon: IconWifi, category: "equipment" },

  // Cahaya & efek
  { value: "IconLamp", label: "Lampu", icon: IconLamp, category: "lighting" },
  { value: "IconBulb", label: "Lampu tambahan", icon: IconBulb, category: "lighting" },
  { value: "IconBolt", label: "Flash / strobe", icon: IconBolt, category: "lighting" },
  { value: "IconSun", label: "Cahaya natural", icon: IconSun, category: "lighting" },
  { value: "IconWind", label: "Kipas / wind machine", icon: IconWind, category: "lighting" },
  { value: "IconCloud", label: "Asap / fog", icon: IconCloud, category: "lighting" },
  DEFAULT_ADDON_ICON_OPTION,

  // Properti & dekorasi
  { value: "IconBackground", label: "Backdrop", icon: IconBackground, category: "props" },
  { value: "IconPalette", label: "Palet warna", icon: IconPalette, category: "props" },
  { value: "IconFrame", label: "Frame", icon: IconFrame, category: "props" },
  { value: "IconArmchair", label: "Kursi", icon: IconArmchair, category: "props" },
  { value: "IconSofa", label: "Sofa", icon: IconSofa, category: "props" },
  { value: "IconFlower", label: "Bunga", icon: IconFlower, category: "props" },
  { value: "IconLeaf", label: "Tanaman", icon: IconLeaf, category: "props" },
  { value: "IconConfetti", label: "Dekorasi pesta", icon: IconConfetti, category: "props" },
  { value: "IconHeart", label: "Prewedding", icon: IconHeart, category: "props" },
  { value: "IconGift", label: "Hadiah", icon: IconGift, category: "props" },
  { value: "IconPhoto", label: "Foto", icon: IconPhoto, category: "props" },

  // Wardrobe & aksesori
  { value: "IconHanger", label: "Wardrobe", icon: IconHanger, category: "wardrobe" },
  { value: "IconShirt", label: "Pakaian", icon: IconShirt, category: "wardrobe" },
  { value: "IconShoe", label: "Sepatu", icon: IconShoe, category: "wardrobe" },
  { value: "IconDiamond", label: "Aksesori", icon: IconDiamond, category: "wardrobe" },
  { value: "IconCrown", label: "Paket premium", icon: IconCrown, category: "wardrobe" },

  // Konsumsi & fasilitas
  { value: "IconCoffee", label: "Kopi", icon: IconCoffee, category: "facility" },
  { value: "IconGlass", label: "Minuman", icon: IconGlass, category: "facility" },
  { value: "IconCookie", label: "Snack", icon: IconCookie, category: "facility" },
  { value: "IconCake", label: "Kue", icon: IconCake, category: "facility" },
  { value: "IconToolsKitchen2", label: "Catering", icon: IconToolsKitchen2, category: "facility" },
  { value: "IconParking", label: "Parkir", icon: IconParking, category: "facility" },
  { value: "IconClock", label: "Tambahan waktu", icon: IconClock, category: "facility" },
  { value: "IconPackage", label: "Paket / album", icon: IconPackage, category: "facility" },
  { value: "IconStar", label: "Layanan unggulan", icon: IconStar, category: "facility" },
] satisfies readonly AddonIconOption[];

export type AddonIconName = (typeof ADDON_ICON_OPTIONS)[number]["value"];

export const DEFAULT_ADDON_ICON: AddonIconName = DEFAULT_ADDON_ICON_OPTION.value;

// Ikon yang sama dikelompokkan per kategori, untuk pemilih ikon bergrup.
export const ADDON_ICON_GROUPS = (
  Object.keys(ADDON_ICON_CATEGORY_LABELS) as AddonIconCategory[]
)
  .map((category) => ({
    category,
    label: ADDON_ICON_CATEGORY_LABELS[category],
    options: ADDON_ICON_OPTIONS.filter((option) => option.category === category),
  }))
  .filter((group) => group.options.length > 0);

export function normalizeAddonIconName(
  iconName: string | null | undefined,
): AddonIconName {
  return ADDON_ICON_OPTIONS.find((option) => option.value === iconName)?.value ??
    DEFAULT_ADDON_ICON;
}

export function resolveAddonIcon(iconName: string | null | undefined): Component {
  return ADDON_ICON_OPTIONS.find((option) => option.value === iconName)?.icon ??
    DEFAULT_ADDON_ICON_OPTION.icon;
}