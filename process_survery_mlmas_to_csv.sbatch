#!/bin/bash
#SBATCH --job-name=to_csv                        # create a short name for your job
#SBATCH --nodes=1                                # node count, pretty much always 1
#SBATCH --ntasks=1                               # total number of tasks across all nodes. also 1
#SBATCH --cpus-per-task=1                        # cpu-cores per task (equal to $SLURM_CPUS_PER_TASK)
#SBATCH -q public                                # mainly keep as public, can use debug for testing
#SBATCH -p general                               # general partition, use htc for jobs shorter than 4 hours
#SBATCH --mem=10G                                # total cpu requested memory
#SBATCH --time=10:00:00                          # total run time limit (HH:MM:SS)
#SBATCH --output=slurm_outs/slurm-%j.out         # for non-array job, where to store and what to name slurm outs

#bash strict mode
set -euo pipefail

while read PHENO
do
    MLMA="/scratch/vsohrab/dap_gwas_geneticset2023_datarelease2022_nextflow/association/${PHENO}_N-*.mlma"
    MLMA=${MLMA[0]} #should all be arrays of length 1
    ls $MLMA
    ./mlma_to_csv.py $MLMA
done < /scratch/vsohrab/dap_gwas_geneticset2023_datarelease2022_nextflow/finalized_survey_questions_in_genetic_analysis_N-154.tsv


