// export const returnMusicStyles = (musicStyle: string, musicStyleOther: string[], musicSubStyles: string[]) => {
//     const genresSet = new Set();

//     if (musicStyle !== undefined && musicStyle) {
//         if (musicSubStyles && musicSubStyles.length > 0) {
//             for (let i = 0; i < musicSubStyles.length; i++) {
//                 if (musicSubStyles[i] === 'Melodic, Minimal') {
//                     genresSet.add('Techno (Melodic, Minimal)');
//                 }
//                 if (musicSubStyles[i] === 'Hard, Peak') {
//                     genresSet.add('Techno (Hard, Peak)');
//                 }
//                 if (musicSubStyles[i] === 'Tech House') {
//                     genresSet.add('House (Tech House)');
//                 }
//                 if (musicSubStyles[i] === 'Melodic, Afro') {
//                     genresSet.add('House (Melodic, Afro)');
//                 }
//             }
//         } else {
//             genresSet.add(musicStyle);
//         }

//         if (musicStyleOther && musicStyleOther.length > 0) {
//             for (let i = 0; i < musicStyleOther.length; i++) {
//                 if (musicStyleOther[i] !== 'House') {
//                     genresSet.add(musicStyleOther[i]);
//                 }
//             }
//         }

//         return Array.from(genresSet);
//     }
// };
