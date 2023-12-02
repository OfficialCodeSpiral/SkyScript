import { SkyScriptErr } from "../util/error.js";

export enum typeOfToken {
	Number,
	Identifier,
	String,
	BinaryOperator,
	Equals,
	BinaryEquals,
	DoubleEquals,
	NotEquals,
	Comma,
	Dot,
	Colon,
	Semicolon,
	OpenParen, 
	CloseParen, 
	OpenBrace, 
	CloseBrace,
    OpenBracket, 
	CloseBracket,
	GreaterThanSign,
	Slash,
	Set,
	Lock,
	Fun,
	If,
	Else,
	While,
	For,
	Return,
	Break,
	Async,
	From,
	Take,
	Give,
	Using,
	EOF,
}

const KEYWORDS: Record<string, typeOfToken> = {
	set: typeOfToken.Set, // implemented
	lock: typeOfToken.Lock, // implemented
	fun: typeOfToken.Fun, // implemented
	if: typeOfToken.If, // implemented
	else: typeOfToken.Else, // implemented
	for: typeOfToken.For, // not implemented
	while: typeOfToken.While, // deprecated cause of loop()
	return: typeOfToken.Return, // not implemented
	break: typeOfToken.Break, // not implemented
	async: typeOfToken.Async, // not implemented
	take: typeOfToken.Take, // not implemented - similar to "import" in typescript
	from: typeOfToken.From, // not implemented - similar to "from" in typescript
	give: typeOfToken.Give, // not implemented - similar to "export" in typescript
	using: typeOfToken.Using // unimplemented
};

export interface Token {
	value: string;
	type: typeOfToken;
}

export class Lexer {
	private src: string[] = [];

	private tokenize(value = "", type: typeOfToken): Token {
		return { value, type } as Token;
	}

	private isAlpha(src: string){
		return src.toUpperCase() != src.toLowerCase();
	}

	private isSkippable(str: string) {
		return str == " " || str == "\n" || str == "\t" || str == "\r" || str == ";" || str == "/";
	}

	private isNumber(str: string) {
		const c = str.charCodeAt(0);
		const bounds = ["0".charCodeAt(0), "9".charCodeAt(0)];
		return c >= bounds[0] && c <= bounds[1];
	}

	public Tokenize(sourceCode: string): Token[] {
		const tokens = new Array<Token>();
		this.src = sourceCode.split("");

		while(this.src.length > 0) {
			let src = this.src[0];

			switch(this.src[0]){
				case "(":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.OpenParen));
				break;
				case ")":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.CloseParen));
				break;
				case "{":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.OpenBrace));
				break;
				case "}":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.CloseBrace));
				break;
				case "[":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.OpenBracket));
				break;
				case "]":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.CloseBracket));
				break;
				case "+":
					switch(this.src[1]){
						case "+":
							this.src.shift();
							tokens.push(this.tokenize(this.src.shift() + "+", typeOfToken.BinaryOperator));
						break;
						case "=":
							tokens.push(this.tokenize(this.src.shift() + "=", typeOfToken.BinaryOperator));
							this.src.shift();
						break;
						default:
							tokens.push(this.tokenize(this.src.shift(), typeOfToken.BinaryOperator));
						break;
					} 
				break;
				case "-":
					switch(this.src[1]){
						case "-":
							this.src.shift();
							tokens.push(this.tokenize(this.src.shift() + "-", typeOfToken.BinaryOperator));
						break;
						case "=":
							tokens.push(this.tokenize(this.src.shift() + "=", typeOfToken.BinaryOperator));
							this.src.shift();
						break;
						default: 
							tokens.push(this.tokenize(this.src.shift(), typeOfToken.BinaryOperator));
						break;
					} 
				break;
				case "*":
					switch(this.src[1]){
						case "=":
							tokens.push(this.tokenize(this.src.shift() + "=", typeOfToken.BinaryOperator));
							this.src.shift();
						break;
						default:
							tokens.push(this.tokenize(this.src.shift(), typeOfToken.BinaryOperator));
						break;
					}
				break;
				case "/":
					switch(this.src[1]){
						case "=":
							tokens.push(this.tokenize(this.src.shift() + "=", typeOfToken.BinaryOperator));
							this.src.shift();
						break;
						case "/":
							tokens.push(this.tokenize(this.src.shift()+'/', typeOfToken.Slash));
							this.src.shift();
						break;
						default:
							tokens.push(this.tokenize(this.src.shift(), typeOfToken.BinaryOperator));
						break;
					}
				break;
				case "%":
					switch(this.src[1]){
						case "=":
							tokens.push(this.tokenize(this.src.shift() + "=", typeOfToken.BinaryOperator));
							this.src.shift();
						break;
						default:
							tokens.push(this.tokenize(this.src.shift(), typeOfToken.BinaryOperator));
						break;
					}
				break;
				case "=":
					switch(this.src[1]){
						case "=":
							this.src.shift();
							this.src.shift();
							tokens.push(this.tokenize("==", typeOfToken.DoubleEquals));
						break;
						default:
							tokens.push(this.tokenize(this.src.shift(), typeOfToken.Equals));
						break;
					}
				break;
				case "!":
					switch(this.src[1]) {
						case "=":
							this.src.shift();
							this.src.shift();
							tokens.push(this.tokenize('!=', typeOfToken.NotEquals));
						break;
						default: break;
					}
				break;
				case ";":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.Semicolon));
				break;
				case ":":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.Colon));
				break;
				case ",":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.Comma));
				break;
				case ".":
					tokens.push(this.tokenize(this.src.shift(), typeOfToken.Dot));
				break;
				case '"': 
				case "'":{
						const thing = this.src.shift()
					let string = ''
		
					while (this.src.length > 1 && this.src[0] != thing) {
						string += this.src.shift()
					}
		
					this.src.shift()
					tokens.push(this.tokenize(string, typeOfToken.String))
					} break;
				default: {
					let a: string;
					if (this.isNumber(this.src[0])) {
						a = "int"
					} else if (this.isAlpha(this.src[0])) {
						a = "alpha"
					} else if (this.isSkippable(this.src[0])) {
						a = "skippable"
					} else { 
						a = "other"
					}
					switch(a){
						case "int": {
							let num = "";
							while (this.src.length > 0 && this.isNumber(this.src[0])) {
								num += this.src.shift();
							}
							tokens.push(this.tokenize(num, typeOfToken.Number));
						} break;
						case "alpha": {
							let ident = "";
						while (this.src.length > 0 && this.isAlpha(this.src[0]) || this.isNumber(this.src[0])) {
							ident += this.src.shift();
						}
						const reserved = KEYWORDS[ident];
						if (typeof reserved == "number") {
							tokens.push(this.tokenize(ident, reserved));
						} else {
							tokens.push(this.tokenize(ident, typeOfToken.Identifier));
						} 
						} break;
						case "skippable":
							this.src.shift(); 
						break;
						default:
							new SkyScriptErr(
								"Unreconized character found in source: " +this.src[0].charCodeAt(0) +"\n"+this.src[0]
							);
						break;
					}
				} break;
			}

		}

		tokens.push({ type: typeOfToken.EOF, value: "EndOfFile" });

		return tokens;
	}
}