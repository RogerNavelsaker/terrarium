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
		rgb(colors.mossGreen[0]!, colors.mossGreen[1]!, colors.mossGreen[2]!, text),
	secondary: (text: string | number) =>
		rgb(colors.earthBrown[0]!, colors.earthBrown[1]!, colors.earthBrown[2]!, text),
	accent: (text: string | number) => `\x1b[38;2;255;183;77m${text}\x1b[0m`,
	muted: (text: string | number) => `\x1b[38;2;120;120;110m${text}\x1b[0m`,
	success: (text: string | number) => `\x1b[32m${text}\x1b[0m`,
	warning: (text: string | number) => `\x1b[33m${text}\x1b[0m`,
	error: (text: string | number) => `\x1b[31m${text}\x1b[0m`,
	info: (text: string | number) => `\x1b[36m${text}\x1b[0m`,
	dim: (text: string | number) => `\x1b[2m${text}\x1b[0m`,
	bold: (text: string | number) => `\x1b[1m${text}\x1b[0m`,
	msgSuccess: (text: string | number) =>
		`${rgb(colors.mossGreen[0]!, colors.mossGreen[1]!, colors.mossGreen[2]!, "\x1b[1m✓\x1b[0m")} ${rgb(colors.mossGreen[0]!, colors.mossGreen[1]!, colors.mossGreen[2]!, text)}`,
	msgWarn: (text: string | number) => `\x1b[33m\x1b[1m!\x1b[0m \x1b[33m${text}\x1b[0m`,
	msgError: (text: string | number) => `\x1b[31m\x1b[1m✗\x1b[0m \x1b[31m${text}\x1b[0m`,
	msgInfo: (text: string | number) => `\x1b[2m  ${text}\x1b[0m`,
};
