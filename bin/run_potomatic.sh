#!/bin/bash

if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable is not set."
    echo "Please set it before running this script."
    exit 1
fi

LANGUAGE_DIR="languages"

# Potomatic is fetched on demand rather than kept in devDependencies: it pulls
# extract-zip, which is abandoned at 2.0.1 with an unpatched symlink path
# traversal (GHSA-jmr9-qjv8-65gv). This script is the only thing that uses it,
# and it is run by hand, so the dependency does not need to sit in the lockfile.
POTOMATIC_REF="github:GravityKit/Potomatic#b0c247675a404dacd1428ce59a3fe7366404cc9c"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PARENT_DIR" || exit 1

LANG_CODES="ar bg_BG cs_CZ da_DK de_DE el es_ES et fi fr_FR he_IL hu_HU id_ID it_IT ja ko_KR lt_LT lv nb_NO nl_NL pl_PL pt_BR pt_PT ro_RO ru_RU sk_SK sl_SI sv_SE th tl tr_TR uk vi zh_CN"


echo "Found language codes: $LANG_CODES"

POT_FILE_PATH="languages/bit-connect.pot"

if [ ! -f "$POT_FILE_PATH" ]; then
    echo "Error: POT file not found at $POT_FILE_PATH"
    exit 1
fi

for lang in $LANG_CODES; do
    echo "Processing language: $lang"

    pnpm dlx "$POTOMATIC_REF" \
        --target-languages "$lang" \
        --pot-file-path "$POT_FILE_PATH" \
        --output-dir "languages/" \
        --po-file-prefix "bit-connect-" \
        --provider openai \
        --api-key "$OPENAI_API_KEY" \
        -m "gpt-4.1-mini" \
        --abort-on-failure

    if [ $? -eq 0 ]; then
        echo "Successfully processed language: $lang"
    else
        echo "Error processing language: $lang"
    fi

    echo "---"
done

echo "Finished processing all languages."