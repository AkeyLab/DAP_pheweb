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

MLMAS=(/scratch/vsohrab/dap_precision2023_metabolite_gwas/association/*.mlma)

for MLMA in ${MLMAS[@]}
do
    echo $MLMA
    ./mlma_to_csv.py $MLMA
done


