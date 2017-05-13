%{
/*
	function list(left, right) {
		if (left instanceof Array) {
			left.push(right)
			return left
		} else {
			return [left, right]
		}
	}
*/
	var xpath = taiji.xpath;
%}

%lex

%s stringDQ stringSQ

%%

\s+							/*skip whitespace */

"ancestor"					return 'ancestor'
"ancestor-or-self"			return 'ancestor-or-self'
"attribute"					return 'attribute'
"child"						return 'child'
"descendant"				return 'descendant'
"descendant-or-self"		return 'descendant-or-self'
"following"					return 'following'
"following-sibling"			return 'following-sibling'
"namespace"					return 'namespace'
"parent"					return 'parent'
"preceding"					return 'preceding'
"preceding-sibling"			return 'preceding-sibling'
"self"						return 'self'

"or"						return 'OR'
"and"						return 'AND'
"="							return '='
"!="						return '!='
"<"							return '<'
">"							return '>'
"<="						return '<='
">="						return '>='
"*"							return '*'
"div"						return 'DIV'
"mod"						return 'MOD'
"-"							return '-'
"+"							return '+'
"^"							return '^'
"!"							return '!'
"%"							return '%'
"|"							return '|'
"("							return '('
")"							return ')'
"@"                         return '@'
"::"                        return '::'
":"                         return ':'
".."                        return '..'
"."                         return '.'
"["                         return '['
"]"                         return ']'
"$"                         return '$'

[0-9]+("."[0-9]+)?\b		return 'NUMBER';

/* TODO: seem state not work. reproduce use XPathParser.parse("'x'")
["]							{this.begin("stringDQ");}
<stringDQ>[^"]*				return 'STRING';
<stringDQ>["]				{this.popState();}
[']							{this.begin("stringSQ");}
<stringSQ>[^']*				return 'STRING';
<stringSQ>[']				{this.popState();}
*/

"'"[^']*"'"					return 'STRING';
["][^"]*["]					return 'STRING';

"/"							return '/';
[a-zA-Z_][a-zA-Z_\.\-0-9]*	return 'NCName';

<<EOF>>						return 'EOF';
.							return 'INVALID';

/lex


/* operator associations and precedence */

%left OR
%left AND
%left '=' '!='
%left '<' '>' '<=' '>='
%left '+' '-'
%left '*' DIV MOD
%left UMINUS
%left '|'
%right '!'

%start expression

%% /* xpath grammar */

expression
	: Expr EOF
		{return $1}
	;

Expr
    : Expr OR Expr
        {$$ = new xpath.Expr.or($1, $3)}
    | Expr AND Expr
        {$$ = new xpath.Expr.and($1, $3)}
    | Expr '=' Expr
        {$$ = new xpath.Expr.equals($1, $3)}
    | Expr '!=' Expr
        {$$ = new xpath.Expr.notequals($1, $3)}
    | Expr '<' Expr
        {$$ = new xpath.Expr.lt($1, $3)}
    | Expr '>' Expr
        {$$ = new xpath.Expr.gt($1, $3)}
    | Expr '<=' Expr
        {$$ = new xpath.Expr.lte($1, $3)}
    | Expr '>=' Expr
        {$$ = new xpath.Expr.gte($1, $3)}
    | Expr '+' Expr
        {$$ = new xpath.Expr.add($1, $3)}
    | Expr '-' Expr
        {$$ = new xpath.Expr.sub($1, $3)}
    | Expr '*' Expr
        {$$ = new xpath.Expr.mul($1, $3)}
    | Expr DIV Expr
        {$$ = new xpath.Expr.div($1, $3)}
    | Expr MOD Expr
        {$$ = new xpath.Expr.mod($1, $3)}
    | '-' Expr %prec UMINUS
        {$$ = new xpath.Expr.uminus($1, $3)}
    | '(' Expr ')'
        {$$ = $2}
    | '$' NCName
        {$$ = new xpath.Expr.varref($2)}
    | NUMBER
        {$$ = Number(yytext)}
    | STRING
        {/*$$ = yytext*/ $$ = yytext.substring(1, yytext.length-1)}
    | PathExpr
        {$$ = $1}
    ;

/* [19] PathExpr ::= LocationPath | FilterExpr | FilterExpr '/' RelativeLocationPath | FilterExpr '//' RelativeLocationPath  */
/* [1] LocationPath ::= RelativeLocationPath | AbsoluteLocationPath  */
/* [2] AbsoluteLocationPath ::= '/' RelativeLocationPath? | AbbreviatedAbsoluteLocationPath  */
/* [10] AbbreviatedAbsoluteLocationPath    ::=    '//' RelativeLocationPath  */
/* [3] RelativeLocationPath ::= Step | RelativeLocationPath '/' Step | AbbreviatedRelativeLocationPath */
/* [36] VariableReference    ::=    '$' QName  */


PathExpr
	: LocationPath
	| '/' LocationPath
		{ $$ = $2; $$.absolute = true }
	;

LocationPath
	: Step
		{ $$ = new xpath.Expr.path([$1], false) }
	| LocationPath '/' Step
		{ $$ = $1; $$.steps.push($3) }
	;

/* [4] Step ::= AxisSpecifier NodeTest Predicate*   | AbbreviatedStep  */
/* [7] NodeTest ::= WildcardName | NodeType '(' ')' | 'processing-instruction' '(' Literal ')' */
/* [5] AxisSpecifier ::=    AxisName '::' | AbbreviatedAxisSpecifier  */
/* [6] AxisName ::= 'ancestor' | 'ancestor-or-self' | 'attribute'  | 'child' | 'descendant'
                    | 'descendant-or-self' | 'following' | 'following-sibling' | 'namespace'
                    | 'parent' | 'preceding' | 'preceding-sibling' | 'self'
*/
/* [13] AbbreviatedAxisSpecifier    ::=    '@'? */
/* [8] Predicate ::= '[' PredicateExpr ']'  */
/* [9] PredicateExpr ::=  Expr  */
/* [12] AbbreviatedStep    ::=    '.'  | '..'  */

Step
	: AxisSpecifier NodeTest 
		{ $$ = new xpath.Step($1, $2, []) }
	| AxisSpecifier NodeTest Predicates
		{ $$ = new xpath.Step($1, $2, $3) }
	| NodeTest 
		{ $$ = new xpath.Step('child', $1, []) }
	| NodeTest Predicates
		{ $$ = new xpath.Step('child', $1, $2) }
	| AbbreviatedStep
	;
	
AxisSpecifier
	: AxisName '::'
		{ $$ = $1 }
	| '@'
		{ $$ = 'attribute' }
	;

AxisName
	: 'ancestor'
	| 'ancestor-or-self'
	| 'attribute'
	| 'child'
	| 'descendant'
	| 'descendant-or-self'
	| 'following'
	| 'following-sibling'
	| 'namespace'
	| 'parent'
	| 'preceding'
	| 'preceding-sibling'
	| 'self'
	;

AbbreviatedStep
	: '.'
		{ $$ = new xpath.Step('self', null, []) }
	| '..'
		{ $$ = new xpath.Step('parent', null, []) }
	;	
	
/* [7] NodeTest ::= WildcardName | NodeType '(' ')' | 'processing-instruction' '(' Literal ')' */	
/* [37] WildcardName    ::=    '*'     | NCName ':' '*'     | QName  */
/* [38] NodeType    ::=    'comment' | 'text'  | 'processing-instruction'  | 'node'  */

NodeTest
	: WildcardName
		{ $$ = new xpath.NodeTest($1, null) }
/*	| NodeType '(' ')'
		{ $$ = new xpath.NodeTest(null, $1) }
	| 'processing-instruction' '(' Literal ')' */
	;

/*
NodeType
	: 'comment'
    | 'text'
    | 'processing-instruction'
    | 'node'
    ;
*/

WildcardName
	: '*'
		{ $$ = new xpath.WName(null, $1) }
	| NCName ':' '*'
		{ $$ = new xpath.WName($1, $3) }
	| NCName ':' NCName
		{ $$ = new xpath.WName($1, $3) }
	| NCName
		{ $$ = new xpath.WName(null, $1) }
	;

Predicate
	: '[' Expr ']'
		{ $$ = $2 }
	;

Predicates
	: Predicate
		{ $$ = [$1] }
	| Predicates Predicate
		{ $$ = $1; $$.push($2) }
	;

