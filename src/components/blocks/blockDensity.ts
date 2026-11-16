import { createContext, useContext } from "react";
import type { BlockDensity } from "../../config/workspace";

// Ярус плотности передаётся вниз контекстом, а не пропсом: иначе каждый из
// девяти блоков должен был бы принять и прокинуть параметр, который ему самому
// не нужен — он нужен только оболочке.
//
// Значение по умолчанию 'cozy' — это не заглушка, а рабочий случай: на
// мобильных блоки рендерятся вне сетки, во всю ширину экрана и без геометрии
// в клетках. Там 'cozy' и есть верный ярус.
export const BlockDensityContext = createContext<BlockDensity>('cozy');

export const useBlockDensity = () => useContext(BlockDensityContext);
