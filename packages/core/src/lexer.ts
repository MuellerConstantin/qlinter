import { createToken, Lexer, type TokenType } from 'chevrotain';

/**
 * Qlik Sense reserved keywords extracted from the Qlik Engine (12.2386.30) GetBaseBNF dump.
 */
export const KEYWORDS = [
  'Access',
  'Add',
  'After',
  'Alias',
  'All',
  'Application',
  'AutoCommit',
  'AutoGenerate',
  'Autonumber',
  'BDI',
  'Between',
  'Binary',
  'Buffer',
  'By',
  'Call',
  'Case',
  'CodePage',
  'Comment',
  'Concatenate',
  'Connect',
  'Connect32',
  'Connect64',
  'Create',
  'Cross',
  'CrossTable',
  'CustomConnect',
  'Declare',
  'Default',
  'Derive',
  'Detail',
  'Dimension',
  'DirList',
  'Direct',
  'DirectQuery',
  'Directory',
  'DisConnect',
  'Distinct',
  'Do',
  'Drop',
  'Each',
  'Else',
  'ElseIf',
  'End',
  'EndIf',
  'EndSub',
  'EndSwitch',
  'Execute',
  'Exit',
  'Explicit',
  'Extension',
  'External',
  'Field',
  'FieldValueList',
  'Fields',
  'FileList',
  'First',
  'FlushLog',
  'For',
  'From',
  'From_Field',
  'Full',
  'Generic',
  'Group',
  'Hierarchy',
  'HierarchyBelongsTo',
  'If',
  'Image_Size',
  'Implicit',
  'Import',
  'Incremental',
  'Info',
  'Inline',
  'Inner',
  'IntervalMatch',
  'Join',
  'Keep',
  'LIB',
  'Left',
  'Let',
  'Live',
  'Load',
  'Loop',
  'Loosen',
  'Map',
  'Mapping',
  'Matching',
  'Measure',
  'Merge',
  'Mixed',
  'Natural',
  'Next',
  'NoConcatenate',
  'NullAsNull',
  'NullAsValue',
  'ODBC',
  'OLEDB',
  'On',
  'Only',
  'Order',
  'Outer',
  'Parameters',
  'Password',
  'QSL',
  'Qualify',
  'Rem',
  'Rename',
  'Replace',
  'Resident',
  'Right',
  'SQL',
  'SQLColumns',
  'SQLTables',
  'SQLTypes',
  'SSO',
  'Sample',
  'Search',
  'Section',
  'Select',
  'Semantic',
  'Set',
  'Sleep',
  'Stale',
  'Star',
  'Store',
  'String',
  'Sub',
  'Switch',
  'Tag',
  'Tagged',
  /*
   * Absent from the GetBaseBNF dump, which folds it into the If production
   * rather than listing it as a terminal. It is a reserved word in every
   * practical sense, so it is listed here explicitly.
   */
  'Then',
  'Trace',
  'Unless',
  'Unmap',
  'Unqualify',
  'Untag',
  'UserID',
  'Using',
  'When',
  'Where',
  'While',
  'With',
  'XPassword',
  'XUserID',
  'and',
  'as',
  'asc',
  'biff',
  'bitand',
  'bitnot',
  'bitor',
  'bitxor',
  'desc',
  'dif',
  'fix',
  'follows',
  'force',
  'html',
  'in',
  'into',
  'json',
  'kml',
  'like',
  'mode',
  'not',
  'null',
  'ooxml',
  'or',
  'parquet',
  'precedes',
  'qvd',
  'qvx',
  'to',
  'txt',
  'write',
  'xml',
  'xor',
];

/**
 * Qlik Sense reserved function names extracted from the Qlik Engine (12.2386.30) GetBaseBNF dump.
 */
export const FUNCTIONS = [
  'ARGB',
  'Abs',
  'Acos',
  'Acosh',
  'AddMonths',
  'AddYears',
  'Age',
  'Alt',
  'ApplyCodepage',
  'ApplyMap',
  'Asin',
  'Asinh',
  'Atan',
  'Atan2',
  'Atanh',
  'Attribute',
  'Author',
  'AutoNumber',
  'AutoNumberHash128',
  'AutoNumberHash256',
  'Avg',
  'BetaDensity',
  'BetaDist',
  'BetaInv',
  'BinomDist',
  'BinomFrequency',
  'BinomInv',
  'BitCount',
  'Black',
  'BlackAndSchole',
  'Blue',
  'Brown',
  'Capitalize',
  'Ceil',
  'Chi2Test_Chi2',
  'Chi2Test_DF',
  'Chi2Test_p',
  'ChiDensity',
  'ChiDist',
  'ChiInv',
  'Chr',
  'Class',
  'ClientPlatform',
  'Coalesce',
  'Color',
  'ColorMapHue',
  'ColorMapJet',
  'ColorMix1',
  'ColorMix2',
  'Combin',
  'ComputerName',
  'Concat',
  'ConnectString',
  'ConvertToLocalTime',
  'Correl',
  'Cos',
  'Cosh',
  'Count',
  'CountRegEx',
  'CountRegExI',
  'Cyan',
  'DarkGray',
  'Date',
  'Date#',
  'Day',
  'DayEnd',
  'DayName',
  'DayNumberOfQuarter',
  'DayNumberOfYear',
  'DayStart',
  'DaylightSaving',
  'Div',
  'DocumentName',
  'DocumentPath',
  'DocumentTitle',
  'Dual',
  'ElapsedSeconds',
  'EmptyIsNull',
  'EngineVersion',
  'Even',
  'Exists',
  'Exp',
  'ExtractRegEx',
  'ExtractRegExGroup',
  'ExtractRegExGroupI',
  'ExtractRegExI',
  'FDensity',
  'FDist',
  'FInv',
  'FV',
  'Fact',
  'False',
  'FastMatch',
  'FieldElemNo',
  'FieldIndex',
  'FieldName',
  'FieldNumber',
  'FieldValue',
  'FieldValueCount',
  'FileBaseName',
  'FileDir',
  'FileExtension',
  'FileName',
  'FilePath',
  'FileSize',
  'FileTime',
  'FindOneOf',
  'FirstSortedValue',
  'FirstValue',
  'FirstWorkDate',
  'Floor',
  'Frac',
  'Fractile',
  'FractileExc',
  'GMT',
  'GammaDensity',
  'GammaDist',
  'GammaInv',
  'GeoAggrGeometry',
  'GeoBoundingBox',
  'GeoCountVertex',
  'GeoGetBoundingBox',
  'GeoGetPolygonCenter',
  'GeoInvProjectGeometry',
  'GeoMakePoint',
  'GeoProject',
  'GeoProjectGeometry',
  'GeoReduceGeometry',
  'GetCollationLocale',
  'GetDataModelHash',
  'GetFolderPath',
  'GetObjectField',
  'GetSysAttr',
  'Green',
  'HCNoRows',
  'HCValue',
  'HSL',
  'Hash128',
  'Hash160',
  'Hash256',
  'Hour',
  'If',
  'InDay',
  'InDayToTime',
  'InLunarWeek',
  'InLunarWeekToDate',
  'InMonth',
  'InMonthToDate',
  'InMonths',
  'InMonthsToDate',
  'InQuarter',
  'InQuarterToDate',
  'InWeek',
  'InWeekToDate',
  'InYear',
  'InYearToDate',
  'Index',
  'IndexRegEx',
  'IndexRegExGroup',
  'IndexRegExGroupI',
  'IndexRegExI',
  'Interval',
  'Interval#',
  'Irr',
  'IsJson',
  'IsNull',
  'IsNum',
  'IsPartialReload',
  'IsRegEx',
  'IsRegExI',
  'IsText',
  'IterNo',
  'JsonArray',
  'JsonGet',
  'JsonObject',
  'JsonSet',
  'JsonSetEx',
  'KeepChar',
  'Kurtosis',
  'LTrim',
  'LastValue',
  'LastWorkDate',
  'Left',
  'Len',
  'LevenshteinDist',
  'LightBlue',
  'LightCyan',
  'LightGray',
  'LightGreen',
  'LightMagenta',
  'LightRed',
  'LinEst_B',
  'LinEst_DF',
  'LinEst_F',
  'LinEst_M',
  'LinEst_R2',
  'LinEst_SEB',
  'LinEst_SEM',
  'LinEst_SEY',
  'LinEst_SSReg',
  'LinEst_SSResid',
  'LocalTime',
  'Log',
  'Log10',
  'Lookup',
  'Lower',
  'LunarWeekEnd',
  'LunarWeekName',
  'LunarWeekStart',
  'Magenta',
  'MakeDate',
  'MakeTime',
  'MakeWeekDate',
  'MapSubString',
  'Match',
  'MatchRegEx',
  'MatchRegExI',
  'Max',
  'MaxString',
  'Median',
  'Mid',
  'Min',
  'MinString',
  'Minute',
  'MissingCount',
  'MixMatch',
  'Mod',
  'Mode',
  'Money',
  'Money#',
  'Month',
  'MonthEnd',
  'MonthName',
  'MonthStart',
  'MonthsEnd',
  'MonthsName',
  'MonthsStart',
  'NetWorkDays',
  'NoOfFields',
  'NoOfRows',
  'NoOfTables',
  'NormDist',
  'NormInv',
  'Now',
  'Npv',
  'Null',
  'NullCount',
  'Num',
  'Num#',
  'NumAvg',
  'NumCount',
  'NumMax',
  'NumMin',
  'NumSum',
  'NumericCount',
  'OSUser',
  'Odd',
  'Only',
  'Ord',
  'PV',
  'Peek',
  'Permut',
  'Pi',
  'Pick',
  'Pmt',
  'PoissonDensity',
  'PoissonDist',
  'PoissonFrequency',
  'PoissonInv',
  'Pow',
  'Previous',
  'ProductVersion',
  'PurgeChar',
  'QVUser',
  'QlikTechBlue',
  'QlikTechGray',
  'QlikViewVersion',
  'QuarterEnd',
  'QuarterName',
  'QuarterStart',
  'QvdCreateTime',
  'QvdFieldName',
  'QvdNoOfFields',
  'QvdNoOfRecords',
  'QvdTableName',
  'RGB',
  'RTrim',
  'Rand',
  'RangeAvg',
  'RangeCorrel',
  'RangeCount',
  'RangeFractile',
  'RangeFractileExc',
  'RangeIrr',
  'RangeKurtosis',
  'RangeMax',
  'RangeMaxString',
  'RangeMin',
  'RangeMinString',
  'RangeMissingCount',
  'RangeMode',
  'RangeNpv',
  'RangeNullCount',
  'RangeNumericCount',
  'RangeOnly',
  'RangeSkew',
  'RangeStDev',
  'RangeSum',
  'RangeTextCount',
  'RangeXirr',
  'RangeXnpv',
  'Rate',
  'RecNo',
  'Red',
  'ReloadTime',
  'Repeat',
  'Replace',
  'ReplaceRegEx',
  'ReplaceRegExGroup',
  'ReplaceRegExGroupI',
  'ReplaceRegExI',
  'Right',
  'Round',
  'RowNo',
  'Second',
  'SetDateYear',
  'SetDateYearMonth',
  'Sign',
  'Sin',
  'Sinh',
  'Skew',
  'Sqr',
  'Sqrt',
  'StDev',
  'StEYX',
  'StErr',
  'SubField',
  'SubFieldRegEx',
  'SubFieldRegExI',
  'SubStringCount',
  'Sum',
  'SysColor',
  'TDensity',
  'TDist',
  'TInv',
  'TTest1_Conf',
  'TTest1_DF',
  'TTest1_Dif',
  'TTest1_Lower',
  'TTest1_Sig',
  'TTest1_StErr',
  'TTest1_Upper',
  'TTest1_t',
  'TTest1w_Conf',
  'TTest1w_DF',
  'TTest1w_Dif',
  'TTest1w_Lower',
  'TTest1w_Sig',
  'TTest1w_StErr',
  'TTest1w_Upper',
  'TTest1w_t',
  'TTest_Conf',
  'TTest_DF',
  'TTest_Dif',
  'TTest_Lower',
  'TTest_Sig',
  'TTest_StErr',
  'TTest_Upper',
  'TTest_t',
  'TTestw_Conf',
  'TTestw_DF',
  'TTestw_Dif',
  'TTestw_Lower',
  'TTestw_Sig',
  'TTestw_StErr',
  'TTestw_Upper',
  'TTestw_t',
  'TableName',
  'TableNumber',
  'Tan',
  'Tanh',
  'Text',
  'TextBetween',
  'TextCount',
  'Time',
  'Time#',
  'TimeZone',
  'Timestamp',
  'Timestamp#',
  'Today',
  'Trim',
  'True',
  'UNBOUNDED',
  'UTC',
  'Upper',
  'WRank',
  'Week',
  'WeekDay',
  'WeekEnd',
  'WeekName',
  'WeekStart',
  'WeekYear',
  'White',
  'WildMatch',
  'Window',
  'Xirr',
  'Xnpv',
  'Year',
  'Year2Date',
  'YearEnd',
  'YearName',
  'YearStart',
  'YearToDate',
  'Yellow',
  'ZTest_Conf',
  'ZTest_Dif',
  'ZTest_Lower',
  'ZTest_Sig',
  'ZTest_StErr',
  'ZTest_Upper',
  'ZTest_z',
  'ZTestw_Conf',
  'ZTestw_Dif',
  'ZTestw_Lower',
  'ZTestw_Sig',
  'ZTestw_StErr',
  'ZTestw_Upper',
  'ZTestw_z',
  'e',
  'fAbs',
  'fMod',
  'nPer',
];

/**
 * Qlik scripting system variables, sourced from the Qlik Sense Enterprise on
 * Windows documentation. Treated as a distinct token type so user-defined
 * variables (declared via SET / LET) remain ordinary identifiers and can be linted
 * independently.
 *
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/SystemVariables/system-variables.htm | System variables}
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/ValueHandlingVariables/value-handling-variables.htm | Value handling variables}
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/NumberInterpretationVariables/number-interpretation-variables.htm | Number interpretation variables}
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/ErrorVariables/ErrorVariables.htm | Error variables}
 */
export const SYSTEM_VARIABLES = [
  'BrokenWeeks',
  'CollationLocale',
  'CreateSearchIndexOnReload',
  'DateFormat',
  'DayNames',
  'DecimalSep',
  'ErrorMode',
  'FirstMonthOfYear',
  'FirstWeekDay',
  'HidePrefix',
  'HideSuffix',
  'Include',
  'LongDayNames',
  'LongMonthNames',
  'MoneyDecimalSep',
  'MoneyFormat',
  'MoneyThousandSep',
  'MonthNames',
  'Must_Include',
  'NullDisplay',
  'NullInterpret',
  'NullValue',
  'NumericalAbbreviation',
  'OpenUrlTimeout',
  'OtherSymbol',
  'ReferenceDay',
  'ScriptError',
  'ScriptErrorCount',
  'ScriptErrorList',
  'ScriptOnlyVariables',
  'StripComments',
  'ThousandSep',
  'TimeFormat',
  'TimestampFormat',
  'Verbatim',
  /*
   * Legacy path variables from the QlikView era. Still listed in the Qlik Sense
   * system variables reference, but effectively obsolete: file access in modern
   * scripts goes through lib:// data connections. Kept here so they tokenize as
   * SystemVariable and can be flagged by a dedicated lint rule.
   */
  'CD',
  'Floppy',
  'QvPath',
  'QvRoot',
  'QvWorkPath',
  'QvWorkRoot',
  'WinPath',
  'WinRoot',
];

/*
 * Trace is split out of the general keyword token so it can push a dedicated
 * lexer mode in which the rest of the statement is consumed as one opaque
 * TraceMessage token. Inside Trace, the body is free text — any words that
 * happen to be Qlik keywords (Load, Where, ...) must not produce a
 * Keyword token, otherwise unrelated rules would flag them.
 */
const KEYWORDS_WITHOUT_TRACE = KEYWORDS.filter((name) => name.toLowerCase() !== 'trace');
const KEYWORD_TOKEN_PATTERN = new RegExp(`(?:${KEYWORDS_WITHOUT_TRACE.join('|')})\\b`, 'i');
const BUILTIN_FUNCTION_TOKEN_PATTERN = new RegExp(
  `^(?:${FUNCTIONS.map((f) => f.replace('#', '\\#')).join('|')})(?=\\s*\\()`,
  'i',
);
const SYSTEM_VARIABLE_TOKEN_PATTERN = new RegExp(`(?:${SYSTEM_VARIABLES.join('|')})\\b`, 'i');

/*
 * Qlik does not publish a positive grammar for identifiers, only a
 * "characters to avoid" list. We therefore define identifiers by what they
 * may NOT contain: whitespace, ASCII operators, brackets/parens, statement
 * delimiters and quotes act as stop chars. Everything else — Unicode
 * letters, digits, `$`, `#`, `@`, `.`, `_` — is identifier material. The
 * first character additionally excludes digits and `.` so number literals
 * and stray dots tokenize separately. See tests/lexer-identifier.test.ts
 * for the documented positive and negative cases.
 *
 * Chevrotain's lexer optimizer inspects the first-char class of a pattern to
 * build a dispatch table, but it cannot interpret Unicode property escapes —
 * `\p{L}` collapses to "no chars", so non-ASCII identifiers (e.g. German
 * umlauts) get reported as lex errors. A custom exec wrapper
 * sidesteps the optimizer and runs the regex verbatim.
 */
const IDENTIFIER_PATTERN = /^[^\s\d.+\-*/=<>&|!?%^(){}[\];,:'"`][^\s+\-*/=<>&|!?%^(){}[\];,:'"`]*/u;

export const identifierToken = createToken({
  name: 'Identifier',
  pattern: {
    exec: (text, offset) => IDENTIFIER_PATTERN.exec(text.slice(offset)),
  },
  line_breaks: false,
});
export const builtinFunctionToken = createToken({
  name: 'BuiltinFunction',
  pattern: {
    exec: (text, offset) => BUILTIN_FUNCTION_TOKEN_PATTERN.exec(text.slice(offset)),
  },
  line_breaks: false,
});
export const systemVariableToken = createToken({
  name: 'SystemVariable',
  pattern: SYSTEM_VARIABLE_TOKEN_PATTERN,
  longer_alt: identifierToken,
  categories: [identifierToken],
});
export const keywordToken = createToken({
  name: 'Keyword',
  pattern: KEYWORD_TOKEN_PATTERN,
  longer_alt: identifierToken,
});

/*
 * Category markers for the keywords that carry block structure. They have no
 * pattern of their own (`Lexer.NA`); the concrete keyword tokens below opt into
 * them, and consumers match with `tokenMatcher`.
 */
export const blockOpenToken = createToken({ name: 'BlockOpen', pattern: Lexer.NA });
export const blockCloseToken = createToken({ name: 'BlockClose', pattern: Lexer.NA });

/**
 * Keywords that end their statement when they are the last token on a line —
 * `If x Then`, a dangling `Do`, `Else`. Every block closer is one too.
 */
export const statementTerminatorToken = createToken({ name: 'StatementTerminator', pattern: Lexer.NA });

function structuralKeyword(name: string, pattern: RegExp, categories: TokenType[]): TokenType {
  return createToken({ name, pattern, longer_alt: identifierToken, categories: [keywordToken, ...categories] });
}

const blockKeywordTokens = [
  structuralKeyword('EndSub', /EndSub\b/i, [blockCloseToken, statementTerminatorToken]),
  structuralKeyword('EndIf', /EndIf\b/i, [blockCloseToken, statementTerminatorToken]),
  structuralKeyword('EndSwitch', /EndSwitch\b/i, [blockCloseToken, statementTerminatorToken]),
  structuralKeyword('End', /End\b/i, [blockCloseToken, statementTerminatorToken]),
  structuralKeyword('Next', /Next\b/i, [blockCloseToken, statementTerminatorToken]),
  structuralKeyword('Loop', /Loop\b/i, [blockCloseToken, statementTerminatorToken]),
  structuralKeyword('Then', /Then\b/i, [statementTerminatorToken]),
  structuralKeyword('Else', /Else(?!If)\b/i, [statementTerminatorToken]),
  structuralKeyword('Default', /Default\b/i, [statementTerminatorToken]),
  structuralKeyword('Do', /Do\b/i, [blockOpenToken, statementTerminatorToken]),
  structuralKeyword('Sub', /Sub\b/i, [blockOpenToken]),
  structuralKeyword('If', /If\b/i, [blockOpenToken]),
  structuralKeyword('For', /For\b/i, [blockOpenToken]),
  structuralKeyword('Switch', /Switch\b/i, [blockOpenToken]),
];

/**
 * Keywords that close a LOAD field list and open the clause list.
 *
 * `Group` and `Order` carry the category; the trailing `By` is not a separate
 * clause and stays on the same line as its head.
 *
 * Deliberately excluded: Distinct, NoConcatenate, Concatenate, Add, Replace,
 * Mapping, Buffer, First, the Join/Keep prefixes, `as`. Those modify the LOAD
 * itself rather than closing its field list.
 */
export const clauseStarterToken = createToken({ name: 'ClauseStarter', pattern: Lexer.NA });

/**
 * The subset of clause keywords that names where a LOAD gets its rows. Where /
 * While / Group / Order narrow or reshape those rows and are deliberately not
 * members: a LOAD carrying none of these is a preceding load, drawing from the
 * statement below it rather than from a source of its own.
 */
export const sourceClauseToken = createToken({ name: 'SourceClause', pattern: Lexer.NA });

const clauseKeywordTokens = [
  structuralKeyword('From_Field', /From_Field\b/i, [clauseStarterToken, sourceClauseToken]),
  structuralKeyword('From', /From\b/i, [clauseStarterToken, sourceClauseToken]),
  structuralKeyword('Resident', /Resident\b/i, [clauseStarterToken, sourceClauseToken]),
  structuralKeyword('Inline', /Inline\b/i, [clauseStarterToken, sourceClauseToken]),
  structuralKeyword('AutoGenerate', /AutoGenerate\b/i, [clauseStarterToken, sourceClauseToken]),
  structuralKeyword('Extension', /Extension\b/i, [clauseStarterToken, sourceClauseToken]),
  structuralKeyword('Where', /Where\b/i, [clauseStarterToken]),
  structuralKeyword('While', /While\b/i, [clauseStarterToken]),
  structuralKeyword('Group', /Group\b/i, [clauseStarterToken]),
  structuralKeyword('Order', /Order\b/i, [clauseStarterToken]),
];

export const traceKeywordToken = createToken({
  name: 'TraceKeyword',
  pattern: /Trace\b/i,
  longer_alt: identifierToken,
  push_mode: 'trace_body',
});

export const traceMessageToken = createToken({
  name: 'TraceMessage',
  pattern: /[^;]+/,
  line_breaks: true,
});

/*
 * `$(Include=…)` / `$(Must_Include=…)` is not an assignment but a fixed dollar
 * expansion form. Qlik matches the literal `Include=` and explicitly forbids a
 * space on either side of the `=` — "Do not put a space character before or
 * after the equal sign" — so an inserted space is a Data Load Editor syntax
 * error, not a style choice. Lexing the whole expansion as one opaque token
 * keeps every spacing and casing rule out of the construct.
 *
 * The pattern tolerates the (invalid) spaced form on purpose: a script that
 * already carries the broken spacing must not be mangled further, and keeping
 * it in a single token leaves a future rule free to flag it off the image.
 *
 * @see {@link https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Scripting/SystemVariables/Include.htm | Include}
 */
export const includeExpansionToken = createToken({
  name: 'IncludeExpansion',
  pattern: /\$\([ \t]*(?:Must_)?Include[ \t]*=[^)\r\n]*\)/i,
  line_breaks: false,
});

/*
 * A `lib://` data connection path is a single lexical unit. Without this token
 * it shatters into `LIB` (a keyword, from `Lib Connect To`) followed by `//`,
 * which starts a line comment — the rest of the path would silently be treated
 * as comment text and the case rule would rewrite the scheme. The bracketed
 * form `[lib://…]` is already covered by bracketToken; this is the unbracketed
 * form that Qlik's own documentation uses.
 */
export const libPathToken = createToken({
  name: 'LibPath',
  pattern: /lib:\/\/[^\s;,()[\]'"]*/i,
  line_breaks: false,
});

export const bracketToken = createToken({ name: 'Bracket', pattern: /\[[^\]]*\]/ });
export const quotedIdentifierToken = createToken({
  name: 'QuotedIdentifier',
  pattern: /"(?:[^"]|"")*"/,
});

/*
 * The third delimiter Qlik accepts for a field or table name, alongside `"` and
 * `[`. Modelled on bracketToken: it runs to the next accent, because the
 * reference documents no escape for one inside a name.
 *
 * @see {@link https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/use-quotes-in-script.htm | Using quotation marks in the script}
 */
export const backtickIdentifierToken = createToken({ name: 'BacktickIdentifier', pattern: /`[^`]*`/ });

export const stringLiteralToken = createToken({ name: 'StringLiteral', pattern: /'(?:[^']|'')*'/ });
export const numberLiteralToken = createToken({
  name: 'NumberLiteral',
  pattern: /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/,
});

export const colonToken = createToken({ name: 'Colon', pattern: /:/ });
export const semicolonToken = createToken({ name: 'Semicolon', pattern: /;/ });

export const traceEndToken = createToken({
  name: 'TraceEnd',
  pattern: /;/,
  pop_mode: true,
  categories: [semicolonToken],
});

export const commaToken = createToken({ name: 'Comma', pattern: /,/ });
export const equalsToken = createToken({ name: 'Equals', pattern: /=/ });
export const punctuationToken = createToken({ name: 'Punctuation', pattern: /[(){}+\-*/<>.@&|?!%^]/ });

const whitespaceToken = createToken({ name: 'Whitespace', pattern: /[ \t]+/, group: Lexer.SKIPPED });
const newlineToken = createToken({ name: 'Newline', pattern: /\r?\n/, group: Lexer.SKIPPED, line_breaks: true });

/*
 * Comments are routed to the 'comments' group instead of being skipped, so they
 * stay out of the main token stream (rules that iterate `tokens` are unaffected)
 * but remain accessible via `result.groups.comments` and the `comments` field on
 * RuleContext for rules that need to inspect them — e.g. comment-style rules.
 */
export const COMMENT_GROUP = 'comments';

export const lineCommentToken = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\n\r]*/,
  group: COMMENT_GROUP,
});

export const blockCommentToken = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: COMMENT_GROUP,
  line_breaks: true,
});

const defaultModeTokens = [
  blockCommentToken,
  lineCommentToken,
  whitespaceToken,
  newlineToken,
  /*
   * Both of these must be tried before the keyword and identifier tokens:
   * each starts with a prefix those tokens would happily match on their own
   * ($ / lib), and only the longer match keeps the construct intact.
   */
  includeExpansionToken,
  libPathToken,
  bracketToken,
  quotedIdentifierToken,
  backtickIdentifierToken,
  stringLiteralToken,
  numberLiteralToken,
  builtinFunctionToken,
  systemVariableToken,
  traceKeywordToken,
  /*
   * Before the general keyword token so the structural keywords win, but after
   * builtinFunctionToken so `If(` still lexes as the function it is.
   */
  ...blockKeywordTokens,
  ...clauseKeywordTokens,
  keywordToken,
  identifierToken,
  colonToken,
  semicolonToken,
  commaToken,
  equalsToken,
  punctuationToken,
];

const traceBodyModeTokens = [traceEndToken, traceMessageToken];

export const allTokens = [...defaultModeTokens, traceMessageToken, traceEndToken];

export const lexer = new Lexer(
  {
    modes: {
      default_mode: defaultModeTokens,
      trace_body: traceBodyModeTokens,
    },
    defaultMode: 'default_mode',
  },
  { positionTracking: 'full' },
);
