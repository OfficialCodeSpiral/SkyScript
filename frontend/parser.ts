// deno-lint-ignore-file no-explicit-any prefer-const
import {
	AssignmentExpr,
	BinaryExpr,
	CallExpr,
	Expr,
	Identifier,
	MemberExpr,
	NumericLiteral,
	ObjectLiteral,
	Program,
	Property,
	Stmt,
	VarDeclaration,
	FunctionDeclaration,
StringLiteral,
IfStmt,
EqualityExpr,
} from "./ast.ts";

import { Token, tokenize, TokenType } from "./lexer.ts";

/**
 * Frontend for producing a valid AST from sourcode
 */
export default class Parser {
	private tokens: Token[] = [];

	/*
	 * Determines if the parsing is complete and the END OF FILE Is reached.
	 */
	private not_eof(): boolean {
		return this.tokens[0].type != TokenType.EOF;
	}

	/**
	 * Returns the currently available token
	 */
	private at() {
		return this.tokens[0] as Token;
	}

	/**
	 * Returns the previous token and then advances the tokens array to the next value.
	 */
	private eat() {
		const prev = this.tokens.shift() as Token;
		return prev;
	}

	/**
	 * Returns the previous token and then advances the tokens array to the next value.
	 *  Also checks the type of expected token and throws if the values dnot match.
	 */
	private expect(type: TokenType, err: any) {
		const prev = this.tokens.shift() as Token;
		if (!prev || prev.type != type) {
			console.error("Parser Error:\n", err, prev, " - Expecting: ", type);
			Deno.exit(1);
		}

		return prev;
	}

	public produceAST(sourceCode: string): Program {
		this.tokens = tokenize(sourceCode);
		const program: Program = {
			kind: "Program",
			body: [],
		};

		// Parse until end of file
		while (this.not_eof()) {
			program.body.push(this.parse_stmt());
		}

		return program;
	}

	// Handle complex statement types
	private parse_stmt(): Stmt {
		// skip to parse_expr
		switch (this.at().type) {
			case TokenType.Set:
			case TokenType.Lock:
				return this.parse_var_declaration();
			case TokenType.Fun:
				return this.parse_fn_declaration();
			case TokenType.If:
				return this.parse_if_stmt();
			default:
				return this.parse_expr();
		}
	}

	private parse_if_stmt(): IfStmt {
        this.expect(TokenType.If, 'Expected "if" keyword.');
        const conditional = this.parse_expr();
        const consequent: Stmt[] = [];
        let right: Expr = {} as Expr;
        let operator: TokenType =TokenType.BinaryEquals;

        this.expect(TokenType.OpenBrace, 'Expected opening brace for consequent block.');

        while (this.at().type !== TokenType.EOF && this.at().type !== TokenType.CloseBrace) {
            consequent.push(this.parse_stmt());
        }
      
        this.expect(TokenType.CloseBrace, 'Expected closing brace for consequent block.');
      
        let alternate: Stmt[] | undefined = undefined;
      
        if (this.at().type === TokenType.Else) {
          this.eat();
      
          if (this.at().type === TokenType.If) {
            alternate = [this.parse_if_stmt()];
          } else {
            alternate = [];
      
            this.expect(TokenType.OpenBrace, 'Expected opening brace for alternate block.');
      
            while (this.at().type !== TokenType.EOF && this.at().type !== TokenType.CloseBrace) {
              alternate.push(this.parse_stmt())
            }
      
            this.expect(TokenType.CloseBrace, 'Expected closing brace for alternate block.');
          }
        }
      
        return {
          kind: 'IfStmt',
          conditional,
          operator,
          right,
          consequent,
          alternate,
        } as IfStmt
      }

	private parse_fn_declaration(): Stmt {
		this.eat(); // eat fn keyword
		const name = this.expect(
			TokenType.Identifier,
			"Expected function name following fn keyword"
		).value;

		const args = this.parse_args();
		const params: string[] = [];
		for (const arg of args) {
			if (arg.kind !== "Identifier") {
				console.log(arg);
				throw "Inside function declaration expected parameters to be of type string.";
			}

			params.push((arg as Identifier).symbol);
		}

		this.expect(
			TokenType.OpenBrace,
			"Expected function body following declaration"
		);
		const body: Stmt[] = [];

		while (
			this.at().type !== TokenType.EOF &&
			this.at().type !== TokenType.CloseBrace
		) {
			body.push(this.parse_stmt());
		}

		this.expect(
			TokenType.CloseBrace,
			"Closing brace expected inside function declaration"
		);

		const fn = {
			body,
			name,
			parameters: params,
			kind: "FunctionDeclaration",
		} as FunctionDeclaration;

		return fn;
	}

	parse_var_declaration(): Stmt {
		const isConstant = this.eat().type == TokenType.Lock;
		const identifier = this.expect(
			TokenType.Identifier,
			"Expected identifier name following let | const keywords."
		).value;

		if (this.at().type == TokenType.Semicolon) {
			this.eat(); // expect semicolon
			if (isConstant) {
				throw "Must assigne value to constant expression. No value provided.";
			}

			return {
				kind: "VarDeclaration",
				identifier,
				constant: false,
			} as VarDeclaration;
		}

		this.expect(
			TokenType.Equals,
			"Expected equals token following identifier in var declaration."
		);

		const declaration = {
			kind: "VarDeclaration",
			value: this.parse_expr(),
			identifier,
			constant: isConstant,
		} as VarDeclaration;

		this.expect(
			TokenType.Semicolon,
			"Variable declaration statment must end with semicolon."
		);

		return declaration;
	}

	// Handle expressions
	private parse_expr(): Expr {
		return this.parse_assignment_expr();
	}

	private parse_assignment_expr(): Expr {
		const left = this.parse_object_expr();

		if (this.at().type == TokenType.Equals) {
			this.eat(); // advance past equals
			const value = this.parse_assignment_expr();
			return { value, assigne: left, kind: "AssignmentExpr" } as AssignmentExpr;
		}

		return left;
	}

	private parse_object_expr(): Expr {
		// { Prop[] }
		if (this.at().type !== TokenType.OpenBrace) {
			return this.parse_additive_expr();
		}

		this.eat(); // advance past open brace.
		const properties = new Array<Property>();

		while (this.not_eof() && this.at().type != TokenType.CloseBrace) {
			const key = this.expect(
				TokenType.Identifier,
				"Object literal key expected"
			).value;

			// Allows shorthand key: pair -> { key, }
			if (this.at().type == TokenType.Comma) {
				this.eat(); // advance past comma
				properties.push({ key, kind: "Property" } as Property);
				continue;
			} // Allows shorthand key: pair -> { key }
			else if (this.at().type == TokenType.CloseBrace) {
				properties.push({ key, kind: "Property" });
				continue;
			}

			// { key: val }
			this.expect(
				TokenType.Colon,
				"Missing colon following identifier in ObjectExpr"
			);
			const value = this.parse_expr();

			properties.push({ kind: "Property", value, key });
			if (this.at().type != TokenType.CloseBrace) {
				this.expect(
					TokenType.Comma,
					"Expected comma or closing bracket following property"
				);
			}
		}

		this.expect(TokenType.CloseBrace, "Object literal missing closing brace.");
		return { kind: "ObjectLiteral", properties } as ObjectLiteral;
	}

	// Handle Addition & Subtraction Operations
	private parse_additive_expr(): Expr {
		let left = this.parse_multiplicitave_expr();

		while (this.at().value == "+" || this.at().value == "-" && this.not_eof()) {
			const operator = this.eat().value;

			const right = this.parse_multiplicitave_expr();
			left = {
				kind: "BinaryExpr",
				left,
				right,
				operator,
			} as BinaryExpr;
		}

		return left;
	}

	private parse_multiplicitave_expr(): Expr {
		let left = this.parse_call_member_expr();

		while ( ["/", "*", "%"].includes(this.at().value) ){
			const operator = this.eat().value;
		
			const right = this.parse_call_member_expr();
			left = {
				kind: "BinaryExpr",
				left,
				right,
				operator,
			} as BinaryExpr;
		}

		return left;
	}

	private parse_call_member_expr(): Expr {
		const member = this.parse_member_expr();

		if (this.at().type == TokenType.OpenParen) {
			return this.parse_call_expr(member);
		}

		return member;
	}

	private parse_call_expr(caller: Expr): Expr {
		let call_expr: Expr = {
			kind: "CallExpr",
			caller,
			args: this.parse_args(),
		} as CallExpr;

		if (this.at().type == TokenType.OpenParen) {
			call_expr = this.parse_call_expr(call_expr);
		}

		return call_expr;
	}

	private parse_args(): Expr[] {
		this.expect(TokenType.OpenParen, "Expected open parenthesis");
		const args =
			this.at().type == TokenType.CloseParen ? [] : this.parse_arguments_list();

		this.expect(
			TokenType.CloseParen,
			"Missing closing parenthesis inside arguments list"
		);
		return args;
	}

	private parse_arguments_list(): Expr[] {
		const args = [this.parse_assignment_expr()];

		while (this.at().type == TokenType.Comma && this.eat()) {
			args.push(this.parse_assignment_expr());
		}

		return args;
	}

	private parse_member_expr(): Expr {
		let object = this.parse_primary_expr();

		while (
			this.at().type == TokenType.Dot ||
			this.at().type == TokenType.OpenBracket
		) {
			const operator = this.eat();
			let property: Expr;
			let computed: boolean;

			if (operator.type == TokenType.Dot) {
				computed = false;
				property = this.parse_primary_expr();
				if (property.kind != "Identifier") {
					throw `Cannonot use dot operator without right hand side being a identifier`;
				}
			} else {
				computed = true;
				property = this.parse_expr();
				this.expect(
					TokenType.CloseBracket,
					"Missing closing bracket in computed value."
				);
			}

			object = {
				kind: "MemberExpr",
				object,
				property,
				computed,
			} as MemberExpr;
		}

		return object;
	}

	private parse_primary_expr(): Expr {
		const tk = this.at().type;

		switch (tk) {
			case TokenType.Identifier:
				return { kind: "Identifier", symbol: this.eat().value } as Identifier;

			case TokenType.Number:
				return {
					kind: "NumericLiteral",
					value: parseFloat(this.eat().value),
				} as NumericLiteral;

			case TokenType.String:
				return { kind: 'StringLiteral', value: this.eat().value } as StringLiteral;
			case TokenType.OpenParen: {
				this.eat(); 
				const left = this.parse_expr();
				let right: Expr;
				let value: Expr;
				let operator: TokenType;
				if (this.at().type == TokenType.DoubleEquals || this.at().type == TokenType.NotEquals) {
                    operator = this.eat().type
                    right = this.parse_expr()
                    value = { kind: 'EqualityExpr', left, operator, right } as EqualityExpr
                } else {
                    value = left
                }
				this.expect(
					TokenType.CloseParen,
					"Unexpected token found inside parenthesised expression. Expected closing parenthesis."
				); 
				return value;
			}

			default:
				console.error("Unexpected token found during parsing!", this.at());
				Deno.exit(1);
		}
	}
}
