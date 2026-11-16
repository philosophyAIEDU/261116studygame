import type { Profile } from '@/types';

// 월드·초상화가 같은 디자인을 공유한다. 기존 저장 데이터는 그대로 쓴다.
export type CharacterAccessory = 'star' | 'bow' | 'glasses' | 'flower';
export interface CharacterDesign extends Pick<Profile, 'hair' | 'hairColor' | 'outfitColor'> {
  skin?: string;
  accessory?: CharacterAccessory;
  adult?: boolean;
}
export const CHARACTER_DESIGNS: Record<string, CharacterDesign> = {
  harper: { hair: 1, hairColor: 1, outfitColor: 3, skin: '#efbc98', accessory: 'flower', adult: true },
  leo: { hair: 0, hairColor: 2, outfitColor: 1, skin: '#c98e67', accessory: 'star' },
  ava: { hair: 2, hairColor: 3, outfitColor: 2, skin: '#f7d2b0', accessory: 'bow' },
  mrbooks: { hair: 0, hairColor: 0, outfitColor: 4, skin: '#dbac88', accessory: 'glasses', adult: true },
  boss: { hair: 1, hairColor: 0, outfitColor: 3, skin: '#b97d5c', accessory: 'glasses', adult: true },
};
export const PORTRAIT_CHARACTERS: Record<string, string> = {
  '👩‍🏫': 'harper', '👦': 'leo', '👱‍♀️': 'ava', '🧓': 'mrbooks', '👩‍💼': 'boss', '👩': 'harper', '🧒': 'leo',
};
