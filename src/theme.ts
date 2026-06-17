// Garden/Earth Theme (os-eco standard branding)
const colors = {
	mossGreen: [85, 139, 47],
	earthBrown: [141, 110, 99],
	leafGreen: [129, 199, 132],
	brightGreen: [76, 175, 80],
	sunlight: [251, 192, 45],
	rust: [216, 67, 21],
	stone: [141, 141, 141],
	cloud: [236, 239, 241],
};

function rgb(r: number, g: number, b: number, text: string | number): string {
	return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

export const theme = {
	primary: (text: string | number) =>
		rgb(colors.mossGreen[0], colors.mossGreen[1], colors.mossGreen[2], text),
	secondary: (text: string | number) =>
		rgb(colors.earthBrown[0], colors.earthBrown[1], colors.earthBrown[2], text),
	accent: (text: string | number) =>
		rgb(colors.leafGreen[0], colors.leafGreen[1], colors.leafGreen[2], text),
	success: (text: string | number) =>
		rgb(colors.brightGreen[0], colors.brightGreen[1], colors.brightGreen[2], text),
	warning: (text: string | number) =>
		rgb(colors.sunlight[0], colors.sunlight[1], colors.sunlight[2], text),
	error: (text: string | number) => rgb(colors.rust[0], colors.rust[1], colors.rust[2], text),
	muted: (text: string | number) => rgb(colors.stone[0], colors.stone[1], colors.stone[2], text),
	text: (text: string | number) => rgb(colors.cloud[0], colors.cloud[1], colors.cloud[2], text),
	bold: (text: string | number) => `\x1b[1m${text}\x1b[0m`,
};
