#bash strict mode
set -euo pipefail
awk -F'\t' '$3 == "gene" { print $1,$4,$5,$9 }' /scratch/vsohrab/reference/UU_Cfam_GSD_1.0_ROSY.refSeq.ensformat.gtf | 
    sed 's/gene_id "//' | 
    sed 's/".*//' | 
    sed 's/^chr//' |
    awk -v OFS='\t' '$1 ~ /^[0-9]+$/ { print $1,$2,$3,$4,$4 }' > UU_CFAM_GSD_1.0_rosy.refseq.ensformat.bed
